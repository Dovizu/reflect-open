import type { OpenDocumentsService } from '../documents/open-documents-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import type { AppLifecycleService, BackgroundTaskToken } from './lifecycle-service.ts'
import type { LoggerService } from './logger-service.ts'
import type { PlatformService } from './platform-service.ts'
import type { WindowService } from './window-service.ts'

/** The dirty state a registered flusher lands. Settings is built in. */
export type PersistenceFlusherKind = 'documents' | 'backup'

export type PersistenceFlusher = () => Promise<void>

/**
 * Lands dirty state before the app exits or the OS suspends it: note buffers
 * and settings first, then the local backup commit, so the commit captures
 * them. A backup flusher makes a local commit only, never a push, which
 * could stall the exit.
 */
export interface PersistenceFlushService {
  /**
   * Install the flusher of `kind`, replacing the previous one. The returned
   * function removes it if it is still installed.
   */
  registerFlusher(kind: PersistenceFlusherKind, fn: PersistenceFlusher): Unlisten
  /** Documents and settings in parallel, then backup. Never rejects; failures are logged. */
  flushAll(): Promise<void>
  /**
   * Flush on window close (the macOS main window hides and stays alive),
   * on a deferred app quit (then confirm it), and on page unload (without
   * waiting). Does nothing outside the native shell.
   */
  installDesktopQuitPolicy(): Unlisten
  /**
   * Flush every time the page turns hidden or is torn down, inside a native
   * background task. One flush runs at a time; a new transition during it
   * queues one more.
   */
  installMobileBackgroundPolicy(): Unlisten
}

export function createPersistenceFlushService(deps: {
  lifecycle: AppLifecycleService
  window: WindowService
  platform: PlatformService
  settings: SettingsService
  openDocuments: Pick<OpenDocumentsService, 'flushAll'>
  logger: LoggerService
}): PersistenceFlushService {
  const { lifecycle, window, platform, settings, openDocuments, logger } = deps
  const flushers = new Map<PersistenceFlusherKind, PersistenceFlusher>([
    ['documents', () => openDocuments.flushAll()],
  ])

  const run = async (what: string, fn: (() => Promise<void>) | undefined): Promise<void> => {
    try {
      await fn?.()
    } catch (cause) {
      logger.error(`${what} flush failed:`, cause)
    }
  }

  const flushAll = async (): Promise<void> => {
    await Promise.allSettled([
      run('documents', flushers.get('documents')),
      run('settings', () => settings.flush()),
    ])
    await run('backup', flushers.get('backup'))
  }

  return {
    registerFlusher(kind, fn) {
      flushers.set(kind, fn)
      return () => {
        if (flushers.get(kind) === fn) {
          flushers.delete(kind)
        }
      }
    },
    flushAll,
    installDesktopQuitPolicy() {
      if (!platform.isNativeShell) {
        return () => {}
      }
      const removeClose = window.onCloseRequested(async (event) => {
        const shouldHide = platform.isMacosDesktop && window.isMainWindow()
        if (shouldHide) {
          // Before any await: AppKit otherwise destroys the last window and the app exits.
          event.preventDefault()
        }
        try {
          if (shouldHide) {
            await window.hide()
          }
        } finally {
          await flushAll()
        }
      })
      // A failed flush still quits: refusing would trap the user.
      const removeQuit = lifecycle.subscribeQuitRequested(() => {
        void flushAll().then(() => {
          void lifecycle.confirmQuit()
        })
      })
      // Unload cannot wait, but writes sent before teardown still reach the shell.
      const removeUnload = lifecycle.subscribeBeforeUnload(() => {
        void run('documents', flushers.get('documents'))
        void run('settings', () => settings.flush())
        void run('backup', flushers.get('backup'))
      })
      return () => {
        removeClose()
        removeQuit()
        removeUnload()
      }
    },
    installMobileBackgroundPolicy() {
      let inFlight: Promise<void> | null = null
      let rerun = false
      let hidden = lifecycle.isHidden()
      let transition = hidden ? 1 : 0
      let lastRequestedTransition = 0

      const runProtected = async (): Promise<void> => {
        let backgroundTask: BackgroundTaskToken | null = null
        try {
          backgroundTask = await lifecycle.beginBackgroundTask()
        } catch {
          // No native protection: the flush stays best-effort.
        }
        try {
          await flushAll()
        } finally {
          if (backgroundTask !== null) {
            try {
              await lifecycle.endBackgroundTask(backgroundTask)
            } catch {
              // The OS expiration handler also ends an outstanding task.
            }
          }
        }
      }

      const flush = (): void => {
        if (inFlight !== null) {
          rerun = true
          return
        }
        inFlight = runProtected()
          .catch(() => {})
          .finally(() => {
            inFlight = null
            if (rerun) {
              rerun = false
              flush()
            }
          })
      }

      const flushTransition = (): void => {
        if (lastRequestedTransition === transition) {
          return
        }
        lastRequestedTransition = transition
        flush()
      }
      const enterHidden = (): void => {
        if (!hidden) {
          hidden = true
          transition += 1
        }
        flushTransition()
      }

      const removeHidden = lifecycle.subscribeHidden(enterHidden)
      const removeVisible = lifecycle.subscribeVisible(() => {
        hidden = false
      })
      const removePageHide = lifecycle.subscribePageHide(enterHidden)
      return () => {
        removeHidden()
        removeVisible()
        removePageHide()
      }
    },
  }
}
