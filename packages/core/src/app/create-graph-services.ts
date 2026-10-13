import type { ChatSession, ChatSessionService } from '../ai/chat/chat-session-service.ts'
import type { AssetDescriptionService } from '../assets/asset-description-service.ts'
import type { CaptureService } from '../capture/capture-service.ts'
import type { AttachmentService } from '../documents/attachment-service.ts'
import type { GraphSessionService } from '../graph/graph-session-service.ts'
import type { MobileOnboardingService } from '../graph/mobile-onboarding-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import {
  createBackupService,
  type BackupService,
  type BackupServiceDeps,
} from '../sync/backup-service.ts'
import {
  createICloudDownloadService,
  type ICloudDownloadServiceDeps,
} from '../sync/icloud-download-service.ts'
import {
  createICloudSyncService,
  isICloudRoot,
  type ICloudSyncServiceDeps,
} from '../sync/icloud-sync-service.ts'
import type { GraphRole, GraphSession } from './graph-session.ts'
import { isMobilePlatform } from './platform.ts'
import type { PlatformFacts } from './platform-service.ts'

/**
 * What {@link createGraphServices} builds the lifecycles of one graph session from.
 */
export interface GraphServicesDeps {
  /**
   * The deps of the backup service that each main-window session builds.
   */
  readonly backup: BackupServiceDeps
  /**
   * The deps of the iCloud conflict service that each main-window session of an iCloud root builds.
   */
  readonly icloudSync: ICloudSyncServiceDeps
  /**
   * The deps of the iCloud download service that runs while the mobile graph is stored in iCloud.
   */
  readonly icloudDownload: ICloudDownloadServiceDeps
  /**
   * Opens the capture drain session of a main-window session.
   */
  readonly capture: Pick<CaptureService, 'openSession'>
  /**
   * Opens the asset description session of a desktop main-window session.
   */
  readonly assetDescription: Pick<AssetDescriptionService, 'openSession'>
  /**
   * Creates the chat session of every session.
   */
  readonly chatSessions: Pick<ChatSessionService, 'create'>
  /**
   * Watches the attachment catalog of every session.
   */
  readonly attachments: Pick<AttachmentService, 'watchCatalog'>
  /**
   * Turns the asset description session on and off with `describeAssets`.
   */
  readonly settings: Pick<SettingsService, 'get' | 'subscribe'>
  /**
   * Turns the iCloud download service on and off with the iCloud storage choice.
   */
  readonly mobileOnboarding: Pick<MobileOnboardingService, 'getState' | 'subscribe'>
  /**
   * Gives the iCloud download service the index refresh it calls after downloads land.
   */
  readonly graphSession: Pick<GraphSessionService, 'refreshIndex'>
  /**
   * Tells mobile from desktop, and the mobile app from a mobile web view.
   */
  readonly platform: Pick<PlatformFacts, 'appPlatform' | 'surface'>
}

/**
 * The factory of each per-session service that {@link createGraphServices} builds.
 */
export const graphServiceFactories = {
  backup: createBackupService,
  icloudSync: createICloudSyncService,
  icloudDownload: createICloudDownloadService,
}

/**
 * The factory of each per-session service; a replacement gets the same deps and options.
 */
export type GraphServiceFactories = typeof graphServiceFactories

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
export interface GraphServices {
  /**
   * The graph session these services run for.
   */
  readonly session: GraphSession
  /**
   * The role of this window for the session; it decides which lifecycles run.
   */
  readonly role: GraphRole
  /**
   * The chat session of this graph.
   */
  readonly chat: ChatSession
  /**
   * The backup lifecycle; `null` in a note window.
   */
  readonly backup: BackupService | null
}

/**
 * Run `open` while `active()` holds, re-checked on every `subscribe` notification.
 */
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

export function createGraphServices(
  session: GraphSession,
  role: GraphRole,
  deps: GraphServicesDeps,
  factories?: Partial<GraphServiceFactories>,
): GraphServices {
  const { root, generation, indexGeneration, signal } = session
  const create = { ...graphServiceFactories, ...factories }
  const {
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
    const mainBackup = create.backup(deps.backup, { generation, indexGeneration })
    backup = mainBackup
    void mainBackup.start()
    disposers.push(() => {
      mainBackup.dispose()
    })
    if (isICloudRoot(root)) {
      const icloud = create.icloudSync(deps.icloudSync, {
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
        const downloads = create.icloudDownload(deps.icloudDownload, {
          root,
          refreshIndex: graphSession.refreshIndex,
        })
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

  return { session, role, chat, backup }
}
