import type { ChatSession, ChatSessionService } from '../ai/chat/chat-session-service.ts'
import type { AssetDescriptionService } from '../assets/asset-description-service.ts'
import type { CaptureService } from '../capture/capture-service.ts'
import type { AttachmentService } from '../documents/attachment-service.ts'
import type { GraphSessionService } from '../graph/graph-session-service.ts'
import type { MobileOnboardingService } from '../graph/mobile-onboarding-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import type { BackupService, BackupServiceFactory } from '../sync/backup-service.ts'
import type { ICloudDownloadServiceFactory } from '../sync/icloud-download-service.ts'
import { isICloudRoot, type ICloudSyncServiceFactory } from '../sync/icloud-sync-service.ts'
import type { GraphRole, GraphSession } from './graph-session.ts'
import { isMobilePlatform } from './platform.ts'
import type { PlatformFacts } from './platform-service.ts'

/** What {@link createGraphServices} builds the lifecycles of one graph session from. */
export interface GraphServicesDeps {
  readonly backups: BackupServiceFactory
  readonly icloudSyncs: ICloudSyncServiceFactory
  readonly icloudDownloads: ICloudDownloadServiceFactory
  readonly capture: Pick<CaptureService, 'openSession'>
  readonly assetDescription: Pick<AssetDescriptionService, 'openSession'>
  readonly chatSessions: Pick<ChatSessionService, 'create'>
  readonly attachments: Pick<AttachmentService, 'watchCatalog'>
  readonly settings: Pick<SettingsService, 'get' | 'subscribe'>
  readonly mobileOnboarding: Pick<MobileOnboardingService, 'getState' | 'subscribe'>
  readonly graphSession: Pick<GraphSessionService, 'refreshIndex'>
  readonly platform: Pick<PlatformFacts, 'appPlatform' | 'surface'>
}

/**
 * The graph-scoped services: one set per {@link GraphSession}, disposed when
 * its `signal` aborts. A graph whose index failed to open has a session too,
 * and its lifecycles run with a null `indexGeneration`.
 *
 * Every window runs the chat session and the attachment catalog watch. Only
 * the main window runs the backup, the iCloud conflict sweeps (iCloud roots),
 * the capture drain, and asset descriptions (desktop, while `describeAssets`
 * is on); a main-window-only field is `null` in a note window. The iCloud
 * download refresh runs while the mobile graph is stored in iCloud. The
 * lifecycles that no surface reads run inside and have no field.
 */
export interface GraphServices<App = unknown> {
  readonly app: App // FIXME: question: WHY GraphServices.app is needed? Where is it used? Can we remove it?
  readonly session: GraphSession
  readonly role: GraphRole
  /** The chat session of this graph. */
  readonly chat: ChatSession
  /** The backup lifecycle; `null` in a note window. */
  readonly backup: BackupService | null
}

/** Run `open` while `active()` holds, re-checked on every `subscribe` notification. */
function whileActive(
  active: () => boolean,
  subscribe: (listener: () => void) => Unlisten,
  open: () => () => void,
): Unlisten {
  let close: (() => void) | null = null
  const follow = (): void => {
    if (active() === (close !== null)) {
      return
    }
    if (close === null) {
      close = open()
    } else {
      close()
      close = null
    }
  }
  const unlisten = subscribe(follow)
  follow()
  return () => {
    unlisten()
    close?.()
    close = null
  }
}

export function createGraphServices<App>(
  app: App,
  session: GraphSession,
  role: GraphRole,
  deps: GraphServicesDeps,
): GraphServices<App> {
  const { root, generation, indexGeneration, signal } = session
  const {
    backups,
    icloudSyncs,
    icloudDownloads,
    capture,
    assetDescription,
    chatSessions,
    attachments,
    settings,
    mobileOnboarding,
    graphSession,
    platform,
  } = deps
  const mobile = isMobilePlatform(platform.appPlatform) || platform.surface.mobileApp
  const disposers: Array<() => void> = []

  const chat = chatSessions.create({ session })
  disposers.push(chat.attach())
  disposers.push(attachments.watchCatalog(generation))

  let backup: BackupService | null = null
  if (role === 'main') {
    const mainBackup = backups.create({ generation, indexGeneration })
    backup = mainBackup
    void mainBackup.start()
    disposers.push(() => {
      mainBackup.dispose()
    })
    if (isICloudRoot(root)) {
      const icloud = icloudSyncs.create({
        root,
        generation,
        indexGeneration,
        metadataWatch: platform.surface.mobileApp,
      })
      void icloud.start()
      disposers.push(() => {
        icloud.dispose()
      })
    }
    const captureSession = capture.openSession({ generation })
    captureSession.start()
    disposers.push(() => {
      captureSession.dispose()
    })
    if (!mobile) {
      disposers.push(
        whileActive(
          () => settings.get().describeAssets,
          settings.subscribe,
          () => {
            const describe = assetDescription.openSession({ generation, indexGeneration })
            describe.start()
            return () => {
              describe.dispose()
            }
          },
        ),
      )
    }
  }
  disposers.push(
    whileActive(
      () => mobileOnboarding.getState().kind === 'icloud',
      mobileOnboarding.subscribe,
      () => {
        const downloads = icloudDownloads.create({ root, refreshIndex: graphSession.refreshIndex })
        downloads.start()
        return () => {
          downloads.dispose()
        }
      },
    ),
  )

  const dispose = (): void => {
    for (const teardown of disposers.splice(0).reverse()) {
      teardown()
    }
  }
  if (signal.aborted) {
    dispose()
  } else {
    signal.addEventListener('abort', dispose, { once: true })
  }

  return { app, session, role, chat, backup }
}
