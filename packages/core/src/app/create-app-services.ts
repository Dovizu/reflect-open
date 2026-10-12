import {
  createChatHistoryService,
  type ChatHistoryService,
} from '../ai/chat/chat-history-service.ts'
import {
  createCaptureInboxService,
  type CaptureInboxService,
} from '../graph/capture-inbox-service.ts'
import {
  createICloudNativeService,
  type ICloudNativeService,
} from '../ipc/icloud-native-service.ts'
import {
  createGitRepositoryService,
  type GitRepositoryService,
} from '../sync/git-repository-service.ts'
import { createXArchiveService, type XArchiveService } from '../x-archive.ts'
import { createWebFetchService, type WebFetchService } from './web-fetch-service.ts'
import type { AudioRecorderService } from '../audio/audio-recorder-service.ts'
import { createPlatformAudioRecorder } from '../audio/default-audio-recorder.ts'
import {
  createClassicAccessService,
  type ClassicAccessService,
} from '../classic/classic-access-service.ts'
import {
  createAppStoreEnvironmentService,
  type AppStoreEnvironmentService,
} from '../monetization/app-store-environment-service.ts'
import { createPaywallService, type PaywallService } from '../monetization/paywall-service.ts'
import {
  createSubscriptionService,
  type SubscriptionService,
} from '../monetization/subscription-service.ts'
import { createCalendarService, type CalendarService } from '../calendar/calendar-service.ts'
import { createContactsService, type ContactsService } from '../contacts/contacts-service.ts'
import { createAssetStoreService, type AssetStoreService } from '../graph/asset-store-service.ts'
import { createNoteFileService, type NoteFileService } from '../graph/note-file-service.ts'
import {
  createEmbeddingRuntimeService,
  type EmbeddingRuntimeService,
} from '../embeddings/embedding-runtime-service.ts'
import { createDatabaseService, type DatabaseService } from '../indexing/database-service.ts'
import { createFileChangeService, type FileChangeService } from '../indexing/file-change-service.ts'
import { createIndexStoreService, type IndexStoreService } from '../indexing/index-store-service.ts'
import { createAppStoreService, type AppStoreService } from '../ipc/app-store-plugin.ts'
import { createIapService, type IapService } from '../ipc/iap-plugin.ts'
import {
  createIpcBridgeService,
  type IpcBridge,
  type IpcBridgeService,
} from '../ipc/ipc-service.ts'
import {
  createMobileStorageService,
  type MobileStorageService,
} from '../ipc/mobile-storage-service.ts'
import { createHapticsService, type HapticsService } from '../ipc/mobile-haptics-plugin.ts'
import { createWebAuthService, type WebAuthService } from '../ipc/web-auth-plugin.ts'
import {
  createSecretStoreService,
  type SecretStoreService,
} from '../secrets/secret-store-service.ts'
import { createAgentSkillService, type AgentSkillService } from './agent-skill-service.ts'
import { createAppInfoService, type AppInfoService } from './app-info-service.ts'
import type { ClipboardService } from './clipboard-service.ts'
import { createSystemClock, type ClockService } from './clock-service.ts'
import type { DialogService } from './dialog-service.ts'
import {
  createDisabledExceptionTelemetry,
  type ExceptionTelemetryService,
} from './exception-telemetry-service.ts'
import { createWebCryptoHashService, type HashService } from './hash-service.ts'
import type { HttpService } from './http-service.ts'
import { createSystemIdService, type IdService } from './id-service.ts'
import { isMobilePlatform } from './platform.ts'
import { createUnavailableImageCodec, type ImageCodecService } from './image-codec-service.ts'
import {
  createLifecycleService,
  type AppLifecycleService,
  type LifecycleDomAdapter,
} from './lifecycle-service.ts'
import { createConsoleLogger, type LoggerService } from './logger-service.ts'
import { createOperationsService, type OperationsService } from './operations-service.ts'
import { createOpenerService, type OpenerService, type OpenerTransport } from './opener-service.ts'
import { createPathService, type PathService, type PathTransport } from './path-service.ts'
import {
  createPlatformService,
  type PlatformFacts,
  type PlatformService,
} from './platform-service.ts'
import { createWebStorageService, type StorageService } from './storage-service.ts'
import {
  createUnsupportedUpdateService,
  createUpdateService,
  type UpdaterAdapter,
  type UpdateService,
} from './update-service.ts'
import { createWindowService, type WindowHost, type WindowService } from './window-service.ts'

/** The app-scoped services: one instance each for the lifetime of the webview. */
export interface AppServices {
  readonly ipc: IpcBridgeService
  readonly logger: LoggerService
  readonly clock: ClockService
  readonly id: IdService
  readonly hash: HashService
  readonly platform: PlatformService
  readonly storage: StorageService
  readonly http: HttpService
  readonly dialog: DialogService
  readonly clipboard: ClipboardService
  readonly opener: OpenerService
  readonly path: PathService
  readonly window: WindowService
  readonly lifecycle: AppLifecycleService
  readonly secretStore: SecretStoreService
  readonly appInfo: AppInfoService
  readonly calendar: CalendarService
  readonly contacts: ContactsService
  readonly agentSkill: AgentSkillService
  readonly mobileStorage: MobileStorageService
  readonly imageCodec: ImageCodecService
  readonly exceptionTelemetry: ExceptionTelemetryService
  readonly operations: OperationsService
  readonly database: DatabaseService
  readonly fileChanges: FileChangeService
  readonly indexStore: IndexStoreService
  readonly embeddingRuntime: EmbeddingRuntimeService
  readonly chatHistory: ChatHistoryService
  readonly update: UpdateService
  readonly gitRepository: GitRepositoryService
  readonly icloudNative: ICloudNativeService
  readonly captureInbox: CaptureInboxService
  readonly webFetch: WebFetchService
  readonly xArchive: XArchiveService
  readonly audioRecorder: AudioRecorderService
  /** Mobile only. */
  readonly haptics?: HapticsService
  /** Mobile only. */
  readonly iap?: IapService
  /** Mobile only. */
  readonly appStore?: AppStoreService
  /** Mobile only. */
  readonly webAuth?: WebAuthService
  readonly classicAccess: ClassicAccessService
  /** Mobile only. */
  readonly subscription?: SubscriptionService
  /** Mobile only. */
  readonly appStoreEnvironment?: AppStoreEnvironmentService
  /** Mobile only. */
  readonly paywall?: PaywallService
  readonly noteFile: NoteFileService
  readonly assetStore: AssetStoreService
}

/** The host primitives that {@link createAppServices} builds the services on. */
export interface AppAdapters {
  readonly ipc: IpcBridge
  readonly platform: PlatformFacts
  readonly http: HttpService
  /** The Web storage areas; `null` keeps an area in memory. */
  readonly storage: { readonly local: Storage | null; readonly session: Storage | null }
  readonly dialog: DialogService
  readonly clipboard: ClipboardService
  readonly opener: OpenerTransport
  readonly path: PathTransport
  readonly window: WindowHost
  readonly lifecycle: LifecycleDomAdapter
  /** Defaults to the console. */
  readonly logger?: LoggerService
  /** Defaults to the system clock. */
  readonly clock?: ClockService
  /** Defaults to the system `IdService`. */
  readonly id?: IdService
  /** Defaults to Web Crypto. */
  readonly hash?: HashService
  /** Defaults to a codec that cannot decode. */
  readonly imageCodec?: ImageCodecService
  /** Defaults to telemetry that reports nothing. */
  readonly exceptionTelemetry?: ExceptionTelemetryService
  /** The native updater; without one, updates are unsupported. */
  readonly updater?: UpdaterAdapter
}

export function createAppServices(adapters: AppAdapters): AppServices {
  const logger = adapters.logger ?? createConsoleLogger()
  const clock = adapters.clock ?? createSystemClock()
  const ipc = createIpcBridgeService(adapters.ipc, { logger })
  const database = createDatabaseService({ ipc })
  const platform = createPlatformService(adapters.platform)
  const windowService = createWindowService({ ipc, host: adapters.window, logger })
  const mobile =
    isMobilePlatform(adapters.platform.appPlatform) || adapters.platform.surface.mobileApp
  const fileChanges = createFileChangeService(
    { ipc, logger },
    { echoOwnWrites: isMobilePlatform(adapters.platform.appPlatform) },
  )
  const id = adapters.id ?? createSystemIdService()
  const storage = createWebStorageService({
    logger,
    localStorage: adapters.storage.local,
    sessionStorage: adapters.storage.session,
  })
  const secretStore = createSecretStoreService({ ipc })
  // The desktop shell's web-auth plugin answers every sign-in as cancelled.
  const webAuth = createWebAuthService({ ipc })
  const classicAccess = createClassicAccessService({
    secretStore,
    http: adapters.http,
    webAuth,
    clock,
    id,
    logger,
  })
  const createMobileServices = () => {
    const iap = createIapService({ ipc, logger })
    const appStore = createAppStoreService({ ipc })
    const subscription = createSubscriptionService({ iap, storage, clock, platform, logger })
    const appStoreEnvironment = createAppStoreEnvironmentService({ appStore, storage, platform })
    return {
      haptics: createHapticsService({ ipc, logger }),
      iap,
      appStore,
      webAuth,
      subscription,
      appStoreEnvironment,
      paywall: createPaywallService({
        subscription,
        classicAccess,
        appStoreEnvironment,
        iap,
        appStore,
        platform,
        storage,
      }),
    }
  }
  return {
    ipc,
    logger,
    clock,
    id,
    hash: adapters.hash ?? createWebCryptoHashService(),
    platform,
    storage,
    http: adapters.http,
    dialog: adapters.dialog,
    clipboard: adapters.clipboard,
    opener: createOpenerService({ transport: adapters.opener, logger }),
    path: createPathService({ transport: adapters.path }),
    window: windowService,
    lifecycle: createLifecycleService({ ipc, dom: adapters.lifecycle, clock, logger }),
    secretStore,
    appInfo: createAppInfoService({ ipc }),
    calendar: createCalendarService({ ipc, logger }),
    contacts: createContactsService({ ipc }),
    agentSkill: createAgentSkillService({ ipc }),
    mobileStorage: createMobileStorageService({ ipc }),
    imageCodec: adapters.imageCodec ?? createUnavailableImageCodec(),
    exceptionTelemetry: adapters.exceptionTelemetry ?? createDisabledExceptionTelemetry(),
    operations: createOperationsService({ clock }),
    database,
    indexStore: createIndexStoreService({ ipc, database }),
    embeddingRuntime: createEmbeddingRuntimeService({ ipc, logger }),
    chatHistory: createChatHistoryService({ ipc, database, logger }),
    update: adapters.updater
      ? createUpdateService({
          updater: adapters.updater,
          clock,
          logger,
          platform,
          window: windowService,
        })
      : createUnsupportedUpdateService(),
    gitRepository: createGitRepositoryService({ ipc }),
    icloudNative: createICloudNativeService({ ipc, logger }),
    captureInbox: createCaptureInboxService({ ipc }),
    webFetch: createWebFetchService({ ipc }),
    xArchive: createXArchiveService({ ipc }),
    audioRecorder: createPlatformAudioRecorder({
      platform: adapters.platform,
      ipc,
      clock,
      logger,
    }),
    classicAccess,
    ...(mobile ? createMobileServices() : {}),
    fileChanges,
    noteFile: createNoteFileService({ ipc, clock, fileChanges }),
    assetStore: createAssetStoreService({ ipc, clock, fileChanges }),
  }
}
