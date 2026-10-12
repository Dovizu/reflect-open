import { createAiCredentialService, type AiCredentialService } from '../ai/ai-credential-service.ts'
import {
  createAiKeyValidationService,
  type AiKeyValidationService,
} from '../ai/ai-key-validation-service.ts'
import { createAiPromptService, type AiPromptService } from '../ai/ai-prompt-service.ts'
import {
  createAiProviderConfigService,
  type AiProviderConfigService,
} from '../ai/ai-provider-config-service.ts'
import {
  createAssetDescriberService,
  type AssetDescriberService,
} from '../ai/asset-describer-service.ts'
import {
  createPageDescriberService,
  type PageDescriberService,
} from '../ai/page-describer-service.ts'
import {
  createSelectionTransformService,
  type SelectionTransformService,
} from '../ai/selection-transform-service.ts'
import {
  createTranscriptEnrichmentService,
  type TranscriptEnrichmentService,
} from '../ai/transcript-enrichment-service.ts'
import {
  createTranscriptionService,
  withAppReviewDemoTranscription,
  type TranscriptionService,
} from '../ai/transcription-service.ts'
import {
  createLanguageModelService,
  createLazyAiSdkLoader,
  withAppReviewDemo,
  type LanguageModelService,
} from '../ai/language-model-service.ts'
import { createChatEngineService, type ChatEngineService } from '../ai/chat/chat-engine-service.ts'
import {
  createChatGraphContextService,
  type ChatGraphContextService,
} from '../ai/chat/chat-graph-context-service.ts'
import {
  createChatHistoryService,
  type ChatHistoryService,
} from '../ai/chat/chat-history-service.ts'
import {
  createChatSessionService,
  type ChatSessionService,
} from '../ai/chat/chat-session-service.ts'
import { fitToContextWindow } from '../ai/chat/context-window.ts'
import { createNoteToolsService, type NoteToolsService } from '../ai/chat/note-tools-service.ts'
import { createAssetReferences } from '../indexing/asset-refs.ts'
import { listDailyNotes } from '../indexing/queries.ts'
import {
  createBacklinkTargetService,
  type BacklinkTargetService,
} from '../capture/backlink-target-service.ts'
import { createCaptureService, type CaptureService } from '../capture/capture-service.ts'
import { createAudioMemoService, type AudioMemoService } from '../audio/audio-memo-service.ts'
import {
  createMobileAudioMemoService,
  type MobileAudioMemoService,
} from '../audio/mobile-audio-memo-service.ts'
import {
  createNativeActionService,
  type NativeActionService,
} from '../audio/native-action-service.ts'
import {
  createAssetDescriptionService,
  type AssetDescriptionService,
} from '../assets/asset-description-service.ts'
import {
  createAssetPrivacyService,
  type AssetPrivacyService,
} from '../assets/asset-privacy-service.ts'
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
import { createGistService, type GistService } from '../sync/gist-service.ts'
import {
  createGitHostCredentialService,
  type GitHostCredentialService,
} from '../sync/git-host-credential-service.ts'
import { createGithubAuthService, type GithubAuthService } from '../sync/github-auth-service.ts'
import { createGithubRepoService, type GithubRepoService } from '../sync/github-repo-service.ts'
import { createSyncEngineFactory, type SyncEngineFactory } from '../sync/engine.ts'
import { createBackupServiceFactory, type BackupServiceFactory } from '../sync/backup-service.ts'
import {
  createConflictResolutionService,
  type ConflictResolutionService,
} from '../sync/conflict-resolution-service.ts'
import {
  createICloudDownloadServiceFactory,
  type ICloudDownloadServiceFactory,
} from '../sync/icloud-download-service.ts'
import {
  createICloudMigrationService,
  type ICloudMigrationService,
} from '../sync/icloud-migration-service.ts'
import {
  createICloudSyncServiceFactory,
  type ICloudSyncServiceFactory,
} from '../sync/icloud-sync-service.ts'
import { createSyncStatusService, type SyncStatusService } from '../sync/sync-status-service.ts'
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
import {
  createGraphSessionService,
  type GraphSessionService,
} from '../graph/graph-session-service.ts'
import {
  createMobileOnboardingService,
  type MobileOnboardingService,
} from '../graph/mobile-onboarding-service.ts'
import { createDailyNoteService, type DailyNoteService } from '../daily/daily-note-service.ts'
import { createKeyboardService, type KeyboardService } from '../mobile/keyboard-service.ts'
import { createShareService, type ShareService } from '../mobile/share-service.ts'
import { createAttachmentService, type AttachmentService } from '../documents/attachment-service.ts'
import { createNoteMoveService, type NoteMoveService } from '../documents/note-move-service.ts'
import {
  createTitleRenameService,
  type TitleRenameService,
} from '../documents/title-rename-service.ts'
import {
  createNoteActionsService,
  type NoteActionsService,
} from '../documents/note-actions-service.ts'
import { createNoteRowService, type NoteRowService } from '../documents/note-row-service.ts'
import { createTemplateService, type TemplateService } from '../documents/template-service.ts'
import {
  createNoteDocumentService,
  type NoteDocumentService,
} from '../documents/note-document-service.ts'
import {
  createNotePreviewService,
  type NotePreviewService,
} from '../documents/note-preview-service.ts'
import { createNoteSessionService, type NoteSessionService } from '../documents/note-session.ts'
import {
  createOpenDocumentsService,
  type OpenDocumentsService,
} from '../documents/open-documents-service.ts'
import {
  createNoteLinkResolverService,
  type NoteLinkResolverService,
} from '../graph/note-link-resolver-service.ts'
import {
  createEmbeddingRuntimeService,
  type EmbeddingRuntimeService,
} from '../embeddings/embedding-runtime-service.ts'
import {
  createEmbeddingIndexService,
  type EmbeddingIndexService,
} from '../embeddings/embedding-index-service.ts'
import { createRetrievalService, type RetrievalService } from '../embeddings/retrieval-service.ts'
import {
  createSemanticSearchService,
  type SemanticSearchService,
} from '../embeddings/semantic-search-service.ts'
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
import {
  createDeepLinkService,
  createNoDeepLinkSource,
  type DeepLinkService,
  type DeepLinkSource,
} from '../navigation/deep-link-service.ts'
import {
  createLinkNavigationService,
  type LinkNavigationService,
} from '../navigation/link-navigation-service.ts'
import {
  createNavigationService,
  type NavigationService,
} from '../navigation/navigation-service.ts'
import { createPrivacyService, type PrivacyService } from '../privacy/privacy-service.ts'
import { createSettingsService, type SettingsService } from '../settings/settings-service.ts'
import { createThemeService, type ThemeService } from '../settings/theme-service.ts'
import { createAgentSkillService, type AgentSkillService } from './agent-skill-service.ts'
import { createAppInfoService, type AppInfoService } from './app-info-service.ts'
import { createBackgroundReconcilerFactory } from './background-reconciler.ts'
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
import { createTaskService, type TaskService } from '../tasks/task-service.ts'
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
import { createCommandService, type CommandService } from '../commands/command-service.ts'
import { createKeymapService, type KeymapService } from '../commands/keymap-service.ts'
import {
  createNativeMenuService,
  createUnsupportedNativeMenuHost,
  type NativeMenuHost,
  type NativeMenuService,
} from '../commands/native-menu-service.ts'

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
  /** The webview's navigation history; a note window has its own webview, hence its own. */
  readonly navigation: NavigationService
  /** The `reflect://` intake of this webview and the handler behind it. */
  readonly deepLink: DeepLinkService
  /** Turns an activated link into a navigation, a new window, or a refusal. */
  readonly linkNavigation: LinkNavigationService
  readonly gitRepository: GitRepositoryService
  readonly githubAuth: GithubAuthService
  readonly gitHostCredentials: GitHostCredentialService
  readonly githubRepos: GithubRepoService
  readonly gists: GistService
  /** Builds the sync engine of one graph session. */
  readonly syncEngines: SyncEngineFactory
  /** Builds the backup lifecycle of one (graph, index session) pair. */
  readonly backups: BackupServiceFactory
  readonly icloudNative: ICloudNativeService
  /** Builds the iCloud conflict lifecycle of one (graph, index session) pair. */
  readonly icloudSyncs: ICloudSyncServiceFactory
  /** Builds the download refresh of one open iCloud graph (mobile). */
  readonly icloudDownloads: ICloudDownloadServiceFactory
  readonly icloudMigration: ICloudMigrationService
  readonly conflictResolution: ConflictResolutionService
  readonly syncStatus: SyncStatusService
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
  readonly noteSessions: NoteSessionService
  readonly openDocuments: OpenDocumentsService
  readonly noteMove: NoteMoveService
  readonly titleRename: TitleRenameService
  readonly noteDocuments: NoteDocumentService
  readonly notePreview: NotePreviewService
  readonly tasks: TaskService
  readonly noteActions: NoteActionsService
  readonly noteRows: NoteRowService
  readonly dailyNotes: DailyNoteService
  readonly templates: TemplateService
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
  readonly graphSession: GraphSessionService
  readonly retrieval: RetrievalService
  readonly embeddingIndex: EmbeddingIndexService
  readonly semanticSearch: SemanticSearchService
  readonly mobileOnboarding: MobileOnboardingService
  readonly keyboard: KeyboardService
  readonly share: ShareService
  readonly aiCredentials: AiCredentialService
  readonly aiKeyValidation: AiKeyValidationService
  readonly languageModel: LanguageModelService
  readonly aiPrompts: AiPromptService
  readonly keymap: KeymapService
  /** The command registry. The app decides the context type that its commands run with. */
  readonly commands: CommandService
  readonly nativeMenu: NativeMenuService
  readonly aiProviderConfig: AiProviderConfigService
  readonly selectionTransform: SelectionTransformService
  readonly pageDescriber: PageDescriberService
  readonly assetDescriber: AssetDescriberService
  readonly transcription: TranscriptionService
  readonly transcriptEnrichment: TranscriptEnrichmentService
  readonly noteTools: NoteToolsService
  readonly chatEngine: ChatEngineService
  readonly chatGraphContext: ChatGraphContextService
  /** Creates the chat session of an open graph; the workspace owns the session. */
  readonly chatSessions: ChatSessionService
  readonly backlinkTarget: BacklinkTargetService
  readonly capture: CaptureService
  readonly audioMemo: AudioMemoService
  /** Mobile only. */
  readonly nativeAction?: NativeActionService
  /** Mobile only. */
  readonly mobileAudioMemo?: MobileAudioMemoService
  readonly assetPrivacy: AssetPrivacyService
  readonly assetDescription: AssetDescriptionService
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
  /** The native menus; without a host, every menu operation rejects. */
  readonly nativeMenu?: NativeMenuHost
  /** Defaults to the URL shape of Apple webviews. */
  readonly convertFileSrc?: FileSrcConverter
  /** The system's `reflect://` delivery; without one, no URL arrives. */
  readonly deepLink?: DeepLinkSource
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
  const audioRecorder = createPlatformAudioRecorder({
    platform: adapters.platform,
    ipc,
    clock,
    logger,
  })
  const createMobileServices = () => {
    const iap = createIapService({ ipc, logger })
    const appStore = createAppStoreService({ ipc })
    const subscription = createSubscriptionService({ iap, storage, clock, platform, logger })
    const appStoreEnvironment = createAppStoreEnvironmentService({ appStore, storage, platform })
    return {
      haptics: createHapticsService({ ipc, logger }),
      nativeAction: createNativeActionService({ audioRecorder, clock, platform, logger }),
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
  const openDocuments = createOpenDocumentsService()
  const indexReads = createIndexReadServices({ database, noteFile })
  const hash = adapters.hash ?? createWebCryptoHashService()
  const indexStore = createIndexStoreService({ ipc, database })
  const xArchive = createXArchiveService({ ipc })
  const commands = createCommandService({ platform, logger })
  const aiCredentials = createAiCredentialService({ secretStore })
  const aiKeyValidation = createAiKeyValidationService({ http: adapters.http })
  const languageModel = withAppReviewDemo(
    createLanguageModelService({ http: adapters.http, sdk: createLazyAiSdkLoader() }),
  )
  const aiProviderConfig = createAiProviderConfigService({
    settings,
    credentials: aiCredentials,
    keyValidation: aiKeyValidation,
    id,
  })
  const noteServices = createNoteServices({ noteFile, wikiResolver: indexReads.wikiResolver, id })
  const path = createPathService({ transport: adapters.path })
  const mobileStorage = createMobileStorageService({ ipc })
  const noteDocuments = createNoteDocumentService({ openDocuments, noteFile })
  const noteMove = createNoteMoveService({ ipc, indexStore, openDocuments, logger })
  const captureInbox = createCaptureInboxService({ ipc })
  const webFetch = createWebFetchService({ ipc })
  const pageDescriber = createPageDescriberService({ languageModel })
  const reconcilers = createBackgroundReconcilerFactory({ lifecycle })
  const assetPrivacy = createAssetPrivacyService({
    noteFile,
    xArchive,
    assetReferences: createAssetReferences({ database, xArchive }),
  })
  const assetDescriber = createAssetDescriberService({ languageModel })
  const backlinkTarget = createBacklinkTargetService({
    noteCreation: noteServices.noteCreation,
    noteFile,
  })
  const indexLifecycle = createIndexLifecycleService({
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
  })
  const graphSession = createGraphSessionService({
    ipc,
    indexLifecycle,
    indexStore,
    noteFile,
    id,
    fileChanges,
    window: windowService,
    dialog: adapters.dialog,
    path,
    platform,
    lifecycle,
    mobileStorage,
    logger,
  })
  const opener = createOpenerService({ transport: adapters.opener, logger })
  const deepLink = createDeepLinkService({
    source: adapters.deepLink ?? createNoDeepLinkSource(),
    indexQuery: indexReads.indexQuery,
    captureInbox,
    operations,
    id,
    clock,
    logger,
  })
  const attachments = createAttachmentService({
    assetStore,
    noteFile,
    fileChanges,
    dialog: adapters.dialog,
    operations,
    clock,
    platform,
  })
  const persistenceFlush = createPersistenceFlushService({
    lifecycle,
    window: windowService,
    platform,
    settings,
    logger,
  })
  const gitRepository = createGitRepositoryService({ ipc })
  const githubAuth = createGithubAuthService({ secretStore, http: adapters.http, clock })
  const gitHostCredentials = createGitHostCredentialService({ secretStore })
  const githubRepos = createGithubRepoService({ http: adapters.http })
  const syncEngines = createSyncEngineFactory({ git: gitRepository, clock })
  const icloudNative = createICloudNativeService({ ipc, logger })
  const embeddingRuntime = createEmbeddingRuntimeService({ ipc, logger })
  const retrieval = createRetrievalService({
    database,
    search: indexReads.search,
    embeddingRuntime,
    logger,
  })
  const embeddingIndex = createEmbeddingIndexService({
    ipc,
    embeddingRuntime,
    noteFile,
    database,
    indexLifecycle,
    logger,
  })
  const transcription = withAppReviewDemoTranscription(
    createTranscriptionService({ http: adapters.http }),
  )
  const transcriptEnrichment = createTranscriptEnrichmentService({ languageModel })
  const audioMemo = createAudioMemoService({
    assetStore,
    noteFile,
    backlinkTarget,
    transcription,
    transcriptEnrichment,
    aiProviderConfig,
    aiCredentials,
    audioRecorder,
    reconcilers,
    lifecycle,
    fileChanges,
    settings,
    operations,
    clock,
    platform,
    window: windowService,
    logger,
  })
  const mobileServices = mobile ? createMobileServices() : null
  const chatHistory = createChatHistoryService({ ipc, database, logger })
  const noteTools = createNoteToolsService({
    retrieval,
    noteFile,
    noteList: indexReads.noteList,
    dailyNotes: { listDailyNotes },
    assetReferences: createAssetReferences({ database, xArchive }),
    xArchive,
    privacy: noteServices.privacy,
  })
  const chatEngine = createChatEngineService({ languageModel, noteTools, fitToContextWindow })
  const chatGraphContext = createChatGraphContextService({
    graphStats: indexReads.graphStats,
    privacy: noteServices.privacy,
  })
  const imageCodec = adapters.imageCodec ?? createUnavailableImageCodec()
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
    opener,
    path,
    window: windowService,
    lifecycle,
    secretStore,
    appInfo: createAppInfoService({ ipc }),
    calendar: createCalendarService({ ipc, logger }),
    contacts: createContactsService({ ipc }),
    agentSkill: createAgentSkillService({ ipc }),
    mobileStorage,
    imageCodec,
    exceptionTelemetry: adapters.exceptionTelemetry ?? createDisabledExceptionTelemetry(),
    operations,
    settings,
    theme: createThemeService({ settings, storage, platform }),
    persistenceFlush,
    database,
    indexStore,
    embeddingRuntime,
    chatHistory,
    navigation: createNavigationService(),
    deepLink,
    linkNavigation: createLinkNavigationService({
      noteLinkResolver: noteServices.noteLinkResolver,
      noteCreation: noteServices.noteCreation,
      wikiResolver: indexReads.wikiResolver,
      window: windowService,
      platform,
      opener,
      deepLink,
      attachments,
      operations,
      logger,
    }),
    update: adapters.updater
      ? createUpdateService({
          updater: adapters.updater,
          clock,
          logger,
          platform,
          window: windowService,
        })
      : createUnsupportedUpdateService(),
    gitRepository,
    githubAuth,
    gitHostCredentials,
    githubRepos,
    syncEngines,
    backups: createBackupServiceFactory({
      git: gitRepository,
      syncEngines,
      githubAuth,
      githubRepos,
      gitHostCredentials,
      fileChanges,
      indexLifecycle,
      operations,
      lifecycle,
      platform,
      persistenceFlush,
      logger,
    }),
    gists: createGistService({ http: adapters.http }),
    icloudNative,
    icloudSyncs: createICloudSyncServiceFactory({
      icloudNative,
      fileChanges,
      indexLifecycle,
      openDocuments,
      lifecycle,
      clock,
      logger,
    }),
    icloudDownloads: createICloudDownloadServiceFactory({ icloudNative, lifecycle, clock, logger }),
    icloudMigration: createICloudMigrationService({ icloudNative }),
    conflictResolution: createConflictResolutionService({ noteFile, indexLifecycle, fileChanges }),
    syncStatus: createSyncStatusService(),
    captureInbox,
    webFetch,
    xArchive,
    audioRecorder,
    classicAccess,
    ...mobileServices,
    fileChanges,
    noteFile,
    assetStore,
    attachments,
    noteSessions: createNoteSessionService({ noteFile, clock, logger }),
    openDocuments,
    noteMove,
    titleRename: createTitleRenameService({
      noteFile,
      wikiResolver: indexReads.wikiResolver,
      backlinks: indexReads.backlinks,
      notePath: indexReads.notePath,
      noteMove,
      openDocuments,
      operations,
      clock,
      logger,
    }),
    keyboard: createKeyboardService(),
    share: createShareService({ openDocuments }),
    noteDocuments,
    notePreview: createNotePreviewService({
      noteLinkResolver: noteServices.noteLinkResolver,
      noteDocuments,
      attachments,
    }),
    tasks: createTaskService({ database, noteDocuments, operations, clock, logger }),
    noteActions: createNoteActionsService({
      noteDocuments,
      noteFile,
      openDocuments,
      indexLifecycle,
      operations,
      clipboard: adapters.clipboard,
      path,
      id,
    }),
    noteRows: createNoteRowService(),
    dailyNotes: createDailyNoteService({ database, clock, lifecycle }),
    templates: createTemplateService({
      noteFile,
      indexQuery: indexReads.indexQuery,
      notePath: indexReads.notePath,
      noteMove,
      openDocuments,
      operations,
    }),
    ...indexReads,
    ...noteServices,
    indexLifecycle,
    graphSession,
    retrieval,
    embeddingIndex,
    semanticSearch: createSemanticSearchService({
      embeddingRuntime,
      embeddingIndex,
      retrieval,
      settings,
      storage,
      window: windowService,
      indexLifecycle,
      graphSession,
      logger,
    }),
    mobileOnboarding: createMobileOnboardingService({
      mobileStorage,
      settings,
      graphSession,
      platform,
      clock,
      logger,
    }),
    aiCredentials,
    aiKeyValidation,
    languageModel,
    aiPrompts: createAiPromptService({ settings, id }),
    keymap: createKeymapService({ platform }),
    commands,
    nativeMenu: createNativeMenuService({
      commands,
      window: windowService,
      platform,
      ipc,
      logger,
      host: adapters.nativeMenu ?? createUnsupportedNativeMenuHost(),
    }),
    aiProviderConfig,
    selectionTransform: createSelectionTransformService({
      languageModel,
      providerConfig: aiProviderConfig,
      credentials: aiCredentials,
      privacy: noteServices.privacy,
    }),
    pageDescriber,
    assetDescriber,
    transcription,
    transcriptEnrichment,
    noteTools,
    chatEngine,
    chatGraphContext,
    chatSessions: createChatSessionService({
      chatEngine,
      chatHistory,
      chatGraphContext,
      providerConfig: aiProviderConfig,
      credentials: aiCredentials,
      embeddingRuntime,
      settings,
      graphSession,
      clock,
      id,
      imageCodec,
      logger,
    }),
    backlinkTarget,
    capture: createCaptureService({
      captureInbox,
      noteFile,
      assetStore,
      openDocuments,
      backlinkTarget,
      xArchive,
      webFetch,
      pageDescriber,
      aiProviderConfig,
      aiCredentials,
      privacy: noteServices.privacy,
      hash,
      clock,
      reconcilers,
      lifecycle,
      fileChanges,
      operations,
      platform,
      logger,
    }),
    audioMemo,
    ...(mobileServices === null
      ? {}
      : {
          nativeAction: mobileServices.nativeAction,
          mobileAudioMemo: createMobileAudioMemoService({
            audioMemo,
            audioRecorder,
            nativeAction: mobileServices.nativeAction,
            lifecycle,
            haptics: mobileServices.haptics,
            platform,
            logger,
          }),
        }),
    assetPrivacy,
    assetDescription: createAssetDescriptionService({
      assetStore,
      noteFile,
      assetPrivacy,
      assetDescriber,
      aiProviderConfig,
      aiCredentials,
      hash,
      clock,
      reconcilers,
      indexLifecycle,
      operations,
      logger,
    }),
  }
}
