import type { OpenDocumentsService } from '../documents/open-documents-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import type { AppLifecycleService, BackgroundTaskToken } from './lifecycle-service.ts'
import type { LoggerService } from './logger-service.ts'
import type { PlatformService } from './platform-service.ts'
import type { WindowService } from './window-service.ts'

/**
 * The dirty state a registered flusher lands. Settings is built in.
 */
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
  /**
   * Documents and settings in parallel, then backup. Never rejects; failures are logged.
   */
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

export interface PersistenceFlushServiceDeps {
  readonly lifecycle: AppLifecycleService
  readonly window: WindowService
  readonly platform: PlatformService
  readonly settings: SettingsService
  readonly openDocuments: Pick<OpenDocumentsService, 'flushAll'>
  readonly logger: LoggerService
}

class PersistenceFlushServiceImpl implements PersistenceFlushService {
  readonly #deps: PersistenceFlushServiceDeps
  readonly #flushers: Map<PersistenceFlusherKind, PersistenceFlusher>
  readonly #mainWindow: boolean

  constructor(deps: PersistenceFlushServiceDeps) {
    this.#deps = deps
    this.#mainWindow = deps.window.isMainWindow()
    this.#flushers = new Map<PersistenceFlusherKind, PersistenceFlusher>([
      ['documents', () => deps.openDocuments.flushAll()],
    ])
  }

  registerFlusher(kind: PersistenceFlusherKind, fn: PersistenceFlusher): Unlisten {
    this.#flushers.set(kind, fn)
    return () => {
      if (this.#flushers.get(kind) === fn) {
        this.#flushers.delete(kind)
      }
    }
  }

  async flushAll(): Promise<void> {
    const { settings } = this.#deps
    await Promise.allSettled([
      this.#run('documents', this.#flushers.get('documents')),
      this.#run('settings', () => settings.flush()),
    ])
    await this.#run('backup', this.#flushers.get('backup'))
  }

  installDesktopQuitPolicy(): Unlisten {
    const { lifecycle, window, platform, settings } = this.#deps
    if (!platform.isNativeShell) {
      return () => {}
    }
    const removeClose = window.onCloseRequested(async (event) => {
      const shouldHide = platform.isMacosDesktop && this.#mainWindow
      if (shouldHide) {
        // Before any await: AppKit otherwise destroys the last window and the app exits.
        event.preventDefault()
      }
      try {
        if (shouldHide) {
          await window.hide()
        }
      } finally {
        await this.flushAll()
      }
    })
    // A failed flush still quits: refusing would trap the user.
    const removeQuit = lifecycle.subscribeQuitRequested(() => {
      void this.flushAll().then(() => {
        void lifecycle.confirmQuit()
      })
    })
    // Unload cannot wait, but writes sent before teardown still reach the shell.
    const removeUnload = lifecycle.subscribeBeforeUnload(() => {
      void this.#run('documents', this.#flushers.get('documents'))
      void this.#run('settings', () => settings.flush())
      void this.#run('backup', this.#flushers.get('backup'))
    })
    return () => {
      removeClose()
      removeQuit()
      removeUnload()
    }
  }

  installMobileBackgroundPolicy(): Unlisten {
    const { lifecycle } = this.#deps
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
        await this.flushAll()
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
  }

  async #run(what: string, fn: (() => Promise<void>) | undefined): Promise<void> {
    try {
      await fn?.()
    } catch (cause) {
      this.#deps.logger.error(`${what} flush failed:`, cause)
    }
  }
}

export function createPersistenceFlushService(
  deps: PersistenceFlushServiceDeps,
): PersistenceFlushService {
  return new PersistenceFlushServiceImpl(deps)
}
