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
import {
  createNoteCreationService,
  type NoteCreationService,
} from '../graph/note-creation-service.ts'
import { createNoteFileService, type NoteFileService } from '../graph/note-file-service.ts'
import { createAttachmentService, type AttachmentService } from '../documents/attachment-service.ts'
import {
  createNoteLinkResolverService,
  type NoteLinkResolverService,
} from '../graph/note-link-resolver-service.ts'
import {
  createEmbeddingRuntimeService,
  type EmbeddingRuntimeService,
} from '../embeddings/embedding-runtime-service.ts'
import { createDatabaseService, type DatabaseService } from '../indexing/database-service.ts'
import { createBacklinkService, type BacklinkService } from '../indexing/backlink-service.ts'
import { createFileChangeService, type FileChangeService } from '../indexing/file-change-service.ts'
import { createGraphStatsService, type GraphStatsService } from '../indexing/graph-stats-service.ts'
import {
  createIndexLifecycleService,
  type IndexLifecycleService,
} from '../indexing/index-lifecycle-service.ts'
import { createIndexQueryService, type IndexQueryService } from '../indexing/index-query-service.ts'
import { createNoteListService, type NoteListService } from '../indexing/note-list-service.ts'
import { createNotePathService, type NotePathService } from '../indexing/note-path-service.ts'
import { createSearchService, type SearchService } from '../indexing/search-service.ts'
import { createSuggestionService, type SuggestionService } from '../indexing/suggestion-service.ts'
import {
  createWikiResolverService,
  type WikiResolverService,
} from '../indexing/wiki-resolver-service.ts'
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
import { createPrivacyService, type PrivacyService } from '../privacy/privacy-service.ts'
import { createSettingsService, type SettingsService } from '../settings/settings-service.ts'
import { createThemeService, type ThemeService } from '../settings/theme-service.ts'
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
  createPersistenceFlushService,
  type PersistenceFlushService,
} from './persistence-flush-service.ts'
import {
  createPlatformService,
  type FileSrcConverter,
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
  readonly settings: SettingsService
  readonly theme: ThemeService
  readonly persistenceFlush: PersistenceFlushService
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
  readonly attachments: AttachmentService
  readonly indexQuery: IndexQueryService
  readonly wikiResolver: WikiResolverService
  readonly backlinks: BacklinkService
  readonly search: SearchService
  readonly suggestions: SuggestionService
  readonly noteList: NoteListService
  readonly graphStats: GraphStatsService
  readonly notePath: NotePathService
  readonly noteLinkResolver: NoteLinkResolverService
  readonly noteCreation: NoteCreationService
  readonly privacy: PrivacyService
  readonly indexLifecycle: IndexLifecycleService
}

/** The read-only services over the index, as {@link AppServices} holds them. */
export type IndexReadServices = Pick<
  AppServices,
  | 'indexQuery'
  | 'wikiResolver'
  | 'backlinks'
  | 'search'
  | 'suggestions'
  | 'noteList'
  | 'graphStats'
  | 'notePath'
>

export function createIndexReadServices(deps: {
  database: DatabaseService
  noteFile: NoteFileService
}): IndexReadServices {
  const { database, noteFile } = deps
  const wikiResolver = createWikiResolverService({ database })
  return {
    indexQuery: createIndexQueryService({ database }),
    wikiResolver,
    backlinks: createBacklinkService({ database, noteFile }),
    search: createSearchService({ database, wikiResolver }),
    suggestions: createSuggestionService({ database }),
    noteList: createNoteListService({ database }),
    graphStats: createGraphStatsService({ database }),
    notePath: createNotePathService({ database, noteFile }),
  }
}

/** The link resolution, note creation and privacy services, as {@link AppServices} holds them. */
export type NoteServices = Pick<AppServices, 'noteLinkResolver' | 'noteCreation' | 'privacy'>

export function createNoteServices(deps: {
  noteFile: NoteFileService
  wikiResolver: WikiResolverService
  id: IdService
}): NoteServices {
  const { noteFile, wikiResolver, id } = deps
  const noteLinkResolver = createNoteLinkResolverService({ wikiResolver, noteFile })
  return {
    noteLinkResolver,
    noteCreation: createNoteCreationService({ noteFile, noteLinkResolver, id }),
    privacy: createPrivacyService({ noteFile }),
  }
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
  /** Defaults to the URL shape of Apple webviews. */
  readonly convertFileSrc?: FileSrcConverter
}

export function createAppServices(adapters: AppAdapters): AppServices {
  const logger = adapters.logger ?? createConsoleLogger()
  const clock = adapters.clock ?? createSystemClock()
  const ipc = createIpcBridgeService(adapters.ipc, { logger })
  const database = createDatabaseService({ ipc })
  const platform = createPlatformService(adapters.platform, undefined, adapters.convertFileSrc)
  const windowService = createWindowService({ ipc, host: adapters.window, logger })
  const mobile =
    isMobilePlatform(adapters.platform.appPlatform) || adapters.platform.surface.mobileApp
  const operations = createOperationsService({ clock })
  const settings = createSettingsService({ ipc, operations })
  const storage = createWebStorageService({
    logger,
    localStorage: adapters.storage.local,
    sessionStorage: adapters.storage.session,
  })
  const lifecycle = createLifecycleService({ ipc, dom: adapters.lifecycle, clock, logger })
  const fileChanges = createFileChangeService(
    { ipc, logger },
    { echoOwnWrites: isMobilePlatform(adapters.platform.appPlatform) },
  )
  const id = adapters.id ?? createSystemIdService()
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
  const noteFile = createNoteFileService({ ipc, clock, fileChanges })
  const assetStore = createAssetStoreService({ ipc, clock, fileChanges })
  const indexReads = createIndexReadServices({ database, noteFile })
  const hash = adapters.hash ?? createWebCryptoHashService()
  const indexStore = createIndexStoreService({ ipc, database })
  const xArchive = createXArchiveService({ ipc })
  return {
    ipc,
    logger,
    clock,
    id,
    hash,
    platform,
    storage,
    http: adapters.http,
    dialog: adapters.dialog,
    clipboard: adapters.clipboard,
    opener: createOpenerService({ transport: adapters.opener, logger }),
    path: createPathService({ transport: adapters.path }),
    window: windowService,
    lifecycle,
    secretStore,
    appInfo: createAppInfoService({ ipc }),
    calendar: createCalendarService({ ipc, logger }),
    contacts: createContactsService({ ipc }),
    agentSkill: createAgentSkillService({ ipc }),
    mobileStorage: createMobileStorageService({ ipc }),
    imageCodec: adapters.imageCodec ?? createUnavailableImageCodec(),
    exceptionTelemetry: adapters.exceptionTelemetry ?? createDisabledExceptionTelemetry(),
    operations,
    settings,
    theme: createThemeService({ settings, storage, platform }),
    persistenceFlush: createPersistenceFlushService({
      lifecycle,
      window: windowService,
      platform,
      settings,
      logger,
    }),
    database,
    indexStore,
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
    xArchive,
    audioRecorder: createPlatformAudioRecorder({
      platform: adapters.platform,
      ipc,
      clock,
      logger,
    }),
    classicAccess,
    ...(mobile ? createMobileServices() : {}),
    fileChanges,
    noteFile,
    assetStore,
    attachments: createAttachmentService({
      assetStore,
      noteFile,
      fileChanges,
      dialog: adapters.dialog,
      operations,
      clock,
      platform,
    }),
    ...indexReads,
    ...createNoteServices({ noteFile, wikiResolver: indexReads.wikiResolver, id }),
    indexLifecycle: createIndexLifecycleService({
      indexStore,
      noteFile,
      fileChanges,
      indexQuery: indexReads.indexQuery,
      database,
      xArchive,
      hash,
      clock,
      logger,
      operations,
    }),
  }
}
