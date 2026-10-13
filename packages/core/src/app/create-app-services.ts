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
  type AiSdkLoader,
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
import { createNativeActionService } from '../audio/native-action-service.ts'
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
import { createGistPublishService, type GistPublishService } from '../sync/gist-publish-service.ts'
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
import { createEmbedMediaService, type EmbedMediaService } from '../embeds/embed-media-service.ts'
import {
  createLinkPreviewService,
  type LinkPreviewService,
} from '../link-preview/link-preview-service.ts'
import { parseLinkPreviewMeta } from '../link-preview/metadata.ts'
import { createWebFetchService, type WebFetchService } from './web-fetch-service.ts'
import { createPlatformAudioRecorder } from '../audio/platform-audio-recorder.ts'
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
import {
  createCalendarEventsService,
  type CalendarEventsService,
} from '../calendar/calendar-events-service.ts'
import { createCalendarService, type CalendarService } from '../calendar/calendar-service.ts'
import {
  createContactSuggestionService,
  type ContactSuggestionService,
} from '../contacts/contact-suggestion-service.ts'
import { createContactsService, type ContactsService } from '../contacts/contacts-service.ts'
import { createMeetingService, type MeetingService } from '../contacts/meeting-service.ts'
import { createPersonNoteService, type PersonNoteService } from '../contacts/person-note-service.ts'
import { createAssetStoreService, type AssetStoreService } from '../graph/asset-store-service.ts'
import {
  createNoteCreationService,
  type NoteCreationService,
} from '../graph/note-creation-service.ts'
import { createNoteFileService, type NoteFileService } from '../graph/note-file-service.ts'
import {
  createGraphSessionService,
  type GraphSessionService,
  type GraphSessionServiceDeps,
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
import { createAppStoreService } from '../ipc/app-store-plugin.ts'
import { createIapService } from '../ipc/iap-plugin.ts'
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
  type UpdateServiceDeps,
} from './update-service.ts'
import { createWindowService, type WindowHost, type WindowService } from './window-service.ts'
import { createCommandService, type CommandService } from '../commands/command-service.ts'
import { createKeymapService, type KeymapService } from '../commands/keymap-service.ts'
import {
  createPaletteSearchService,
  type PaletteSearchService,
} from '../search/palette-search-service.ts'
import {
  createWikiLinkSuggestionService,
  type WikiLinkSuggestionService,
} from '../search/wiki-link-suggestion-service.ts'
import {
  createNativeMenuService,
  createUnsupportedNativeMenuHost,
  type NativeMenuHost,
  type NativeMenuService,
} from '../commands/native-menu-service.ts'
import { createGraphServices, type GraphServices } from './create-graph-services.ts'
import type { AudioRecorderService } from '../audio/audio-recorder-service.ts'

/** The app-scoped services: one instance each for the lifetime of the webview. */
export interface AppServices {
  readonly ipc: IpcBridgeService
  readonly logger: LoggerService
  readonly clock: ClockService
  readonly id: IdService
  readonly hash: HashService
  readonly platform: PlatformService
  readonly storage: StorageService
  readonly dialog: DialogService
  readonly clipboard: ClipboardService
  readonly opener: OpenerService
  readonly path: PathService
  readonly window: WindowService
  readonly lifecycle: AppLifecycleService
  readonly appInfo: AppInfoService
  readonly calendar: CalendarService
  readonly calendarEvents: CalendarEventsService
  readonly contacts: ContactsService
  readonly contactSuggestions: ContactSuggestionService
  readonly meetings: MeetingService
  readonly agentSkill: AgentSkillService
  readonly mobileStorage: MobileStorageService
  readonly imageCodec: ImageCodecService
  readonly exceptionTelemetry: ExceptionTelemetryService
  readonly operations: OperationsService
  readonly settings: SettingsService
  readonly theme: ThemeService
  readonly persistenceFlush: PersistenceFlushService
  readonly fileChanges: FileChangeService
  readonly embeddingRuntime: EmbeddingRuntimeService
  readonly chatHistory: ChatHistoryService
  readonly update: UpdateService
  /** The webview's navigation history; a note window has its own webview, hence its own. */
  readonly navigation: NavigationService
  /** The `reflect://` intake of this webview and the handler behind it. */
  readonly deepLink: DeepLinkService
  /** Turns an activated link into a navigation, a new window, or a refusal. */
  readonly linkNavigation: LinkNavigationService
  readonly githubAuth: GithubAuthService
  readonly gistPublish: GistPublishService
  readonly icloudNative: ICloudNativeService
  readonly icloudMigration: ICloudMigrationService
  readonly conflictResolution: ConflictResolutionService
  readonly syncStatus: SyncStatusService
  readonly embedMedia: EmbedMediaService
  readonly linkPreview: LinkPreviewService
  readonly classicAccess: ClassicAccessService
  readonly noteFile: NoteFileService
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
  readonly backlinks: BacklinkService
  readonly search: SearchService
  readonly noteList: NoteListService
  readonly notePath: NotePathService
  readonly noteCreation: NoteCreationService
  readonly indexLifecycle: IndexLifecycleService
  /** The active graph; its state carries the graph-scoped services of the open session. */
  readonly graphSession: GraphSessionService<GraphServices<AppServices>>
  readonly semanticSearch: SemanticSearchService
  readonly mobileOnboarding: MobileOnboardingService
  readonly keyboard: KeyboardService
  readonly share: ShareService
  readonly aiPrompts: AiPromptService
  readonly keymap: KeymapService
  /** The command registry. The app decides the context type that its commands run with. */
  readonly commands: CommandService
  readonly nativeMenu: NativeMenuService
  readonly aiProviderConfig: AiProviderConfigService
  readonly selectionTransform: SelectionTransformService
  /** Creates the chat session of an open graph; the workspace owns the session. */
  readonly chatSessions: ChatSessionService
  readonly capture: CaptureService
  readonly audioMemo: AudioMemoService
  readonly assetDescription: AssetDescriptionService
  /** The editor's `[[` and `#` menus. */
  readonly wikiLinkSuggestions: WikiLinkSuggestionService
  /** The command palette's data layer. */
  readonly paletteSearch: PaletteSearchService
  /** The services that only a mobile platform builds; `null` elsewhere. */
  readonly mobile: MobileServices | null
}

/** The mobile-only services that the app reads. */
export interface MobileServices {
  readonly haptics: HapticsService
  readonly subscription: SubscriptionService
  readonly appStoreEnvironment: AppStoreEnvironmentService
  readonly paywall: PaywallService
  readonly mobileAudioMemo: MobileAudioMemoService
}

/** The read-only services over the index. */
export interface IndexReadServices {
  readonly indexQuery: IndexQueryService
  readonly wikiResolver: WikiResolverService
  readonly backlinks: BacklinkService
  readonly search: SearchService
  readonly suggestions: SuggestionService
  readonly noteList: NoteListService
  readonly graphStats: GraphStatsService
  readonly notePath: NotePathService
}

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

/** The link resolution, note creation and privacy services. */
export interface NoteServices {
  readonly noteLinkResolver: NoteLinkResolverService
  readonly noteCreation: NoteCreationService
  readonly privacy: PrivacyService
}

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

/** The factory of every service {@link createAppServices} builds, by key. */
export const appServiceFactories = {
  ipc: createIpcBridgeService,
  database: createDatabaseService,
  platform: createPlatformService,
  window: createWindowService,
  operations: createOperationsService,
  settings: createSettingsService,
  storage: createWebStorageService,
  lifecycle: createLifecycleService,
  fileChanges: createFileChangeService,
  secretStore: createSecretStoreService,
  webAuth: createWebAuthService,
  classicAccess: createClassicAccessService,
  audioRecorder: createPlatformAudioRecorder,
  iap: createIapService,
  appStore: createAppStoreService,
  subscription: createSubscriptionService,
  appStoreEnvironment: createAppStoreEnvironmentService,
  haptics: createHapticsService,
  nativeAction: createNativeActionService,
  paywall: createPaywallService,
  mobileAudioMemo: createMobileAudioMemoService,
  noteFile: createNoteFileService,
  assetStore: createAssetStoreService,
  openDocuments: createOpenDocumentsService,
  indexReads: createIndexReadServices,
  indexStore: createIndexStoreService,
  xArchive: createXArchiveService,
  commands: createCommandService,
  aiCredentials: createAiCredentialService,
  aiKeyValidation: createAiKeyValidationService,
  languageModel: (deps: { http: HttpService; sdk: AiSdkLoader }): LanguageModelService =>
    withAppReviewDemo(createLanguageModelService(deps)),
  aiProviderConfig: createAiProviderConfigService,
  noteServices: createNoteServices,
  calendar: createCalendarService,
  contacts: createContactsService,
  personNotes: createPersonNoteService,
  path: createPathService,
  mobileStorage: createMobileStorageService,
  noteDocuments: createNoteDocumentService,
  noteMove: createNoteMoveService,
  captureInbox: createCaptureInboxService,
  webFetch: createWebFetchService,
  pageDescriber: createPageDescriberService,
  reconcilers: createBackgroundReconcilerFactory,
  assetPrivacy: createAssetPrivacyService,
  assetDescriber: createAssetDescriberService,
  backlinkTarget: createBacklinkTargetService,
  indexLifecycle: createIndexLifecycleService,
  graphSession: (
    deps: GraphSessionServiceDeps<GraphServices<AppServices>>,
  ): GraphSessionService<GraphServices<AppServices>> => createGraphSessionService(deps),
  graphServices: createGraphServices,
  opener: createOpenerService,
  navigation: createNavigationService,
  deepLink: createDeepLinkService,
  attachments: createAttachmentService,
  persistenceFlush: createPersistenceFlushService,
  gitRepository: createGitRepositoryService,
  githubAuth: createGithubAuthService,
  githubRepos: createGithubRepoService,
  gists: createGistService,
  noteRows: createNoteRowService,
  syncEngines: createSyncEngineFactory,
  icloudNative: createICloudNativeService,
  embeddingRuntime: createEmbeddingRuntimeService,
  retrieval: createRetrievalService,
  embeddingIndex: createEmbeddingIndexService,
  transcription: (deps: { http: HttpService }): TranscriptionService =>
    withAppReviewDemoTranscription(createTranscriptionService(deps)),
  transcriptEnrichment: createTranscriptEnrichmentService,
  audioMemo: createAudioMemoService,
  /** Builds the mobile services on a mobile platform only. */
  mobile: (deps: {
    platform: PlatformFacts
    build: () => MobileServices
  }): MobileServices | null =>
    isMobilePlatform(deps.platform.appPlatform) || deps.platform.surface.mobileApp
      ? deps.build()
      : null,
  chatHistory: createChatHistoryService,
  dailyNotes: createDailyNoteService,
  noteTools: createNoteToolsService,
  chatEngine: createChatEngineService,
  chatGraphContext: createChatGraphContextService,
  appInfo: createAppInfoService,
  calendarEvents: createCalendarEventsService,
  contactSuggestions: createContactSuggestionService,
  meetings: createMeetingService,
  agentSkill: createAgentSkillService,
  theme: createThemeService,
  linkNavigation: createLinkNavigationService,
  /** Without an updater, updates are unsupported. */
  update: (
    deps: Omit<UpdateServiceDeps, 'updater'> & { updater: UpdaterAdapter | undefined },
  ): UpdateService =>
    deps.updater
      ? createUpdateService({ ...deps, updater: deps.updater })
      : createUnsupportedUpdateService(),
  backups: createBackupServiceFactory,
  gistPublish: createGistPublishService,
  icloudSyncs: createICloudSyncServiceFactory,
  icloudDownloads: createICloudDownloadServiceFactory,
  icloudMigration: createICloudMigrationService,
  conflictResolution: createConflictResolutionService,
  syncStatus: createSyncStatusService,
  embedMedia: createEmbedMediaService,
  linkPreview: createLinkPreviewService,
  noteSessions: createNoteSessionService,
  titleRename: createTitleRenameService,
  keyboard: createKeyboardService,
  share: createShareService,
  notePreview: createNotePreviewService,
  tasks: createTaskService,
  noteActions: createNoteActionsService,
  templates: createTemplateService,
  semanticSearch: createSemanticSearchService,
  mobileOnboarding: createMobileOnboardingService,
  aiPrompts: createAiPromptService,
  keymap: createKeymapService,
  nativeMenu: createNativeMenuService,
  selectionTransform: createSelectionTransformService,
  chatSessions: createChatSessionService,
  capture: createCaptureService,
  assetDescription: createAssetDescriptionService,
  wikiLinkSuggestions: createWikiLinkSuggestionService,
  paletteSearch: createPaletteSearchService,
}

/** The factory of each service key; a replacement gets the same dependencies. */
export type ServiceFactories = typeof appServiceFactories

/** The services that {@link createAppServices} builds but keeps out of {@link AppServices}. */
export interface InternalServices {
  readonly http: HttpService
  readonly secretStore: SecretStoreService
  readonly personNotes: PersonNoteService
  readonly database: DatabaseService
  readonly indexStore: IndexStoreService
  readonly gitRepository: GitRepositoryService
  readonly githubRepos: GithubRepoService
  readonly gists: GistService
  readonly syncEngines: SyncEngineFactory
  readonly captureInbox: CaptureInboxService
  readonly webFetch: WebFetchService
  readonly xArchive: XArchiveService
  readonly audioRecorder: AudioRecorderService
  readonly webAuth: WebAuthService
  readonly assetStore: AssetStoreService
  readonly wikiResolver: WikiResolverService
  readonly suggestions: SuggestionService
  readonly graphStats: GraphStatsService
  readonly noteLinkResolver: NoteLinkResolverService
  readonly privacy: PrivacyService
  readonly retrieval: RetrievalService
  readonly embeddingIndex: EmbeddingIndexService
  readonly aiCredentials: AiCredentialService
  readonly aiKeyValidation: AiKeyValidationService
  readonly languageModel: LanguageModelService
  readonly pageDescriber: PageDescriberService
  readonly assetDescriber: AssetDescriberService
  readonly transcription: TranscriptionService
  readonly transcriptEnrichment: TranscriptEnrichmentService
  readonly noteTools: NoteToolsService
  readonly chatEngine: ChatEngineService
  readonly chatGraphContext: ChatGraphContextService
  readonly backlinkTarget: BacklinkTargetService
  readonly assetPrivacy: AssetPrivacyService
  readonly backups: BackupServiceFactory
  readonly icloudSyncs: ICloudSyncServiceFactory
  readonly icloudDownloads: ICloudDownloadServiceFactory
}

export function createAppServices(
  adapters: AppAdapters,
  factories?: Partial<ServiceFactories>,
): AppServices {
  return composeAppServices(adapters, factories).services
}

/** {@link createAppServices}, plus the services it keeps internal. */
export function composeAppServices(
  adapters: AppAdapters,
  factories?: Partial<ServiceFactories>,
): { services: AppServices; internal: InternalServices } {
  const create: ServiceFactories = { ...appServiceFactories, ...factories }
  const logger = adapters.logger ?? createConsoleLogger()
  const clock = adapters.clock ?? createSystemClock()
  const ipc = create.ipc(adapters.ipc, { logger })
  const database = create.database({ ipc })
  const platform = create.platform(adapters.platform, undefined, adapters.convertFileSrc)
  const windowService = create.window({ ipc, host: adapters.window, logger })
  const operations = create.operations({ clock })
  const settings = create.settings({ ipc, operations })
  const storage = create.storage({
    logger,
    localStorage: adapters.storage.local,
    sessionStorage: adapters.storage.session,
  })
  const lifecycle = create.lifecycle({ ipc, dom: adapters.lifecycle, clock, logger })
  const fileChanges = create.fileChanges(
    { ipc, logger },
    { echoOwnWrites: isMobilePlatform(adapters.platform.appPlatform) },
  )
  const id = adapters.id ?? createSystemIdService()
  const secretStore = create.secretStore({ ipc })
  // The desktop shell's web-auth plugin answers every sign-in as cancelled.
  const webAuth = create.webAuth({ ipc })
  const classicAccess = create.classicAccess({
    secretStore,
    http: adapters.http,
    webAuth,
    clock,
    id,
    lifecycle,
    platform,
    logger,
  })
  const audioRecorder = create.audioRecorder({
    platform: adapters.platform,
    ipc,
    clock,
    logger,
  })
  const createMobileServices = (): MobileServices => {
    const iap = create.iap({ ipc, logger })
    const appStore = create.appStore({ ipc })
    const subscription = create.subscription({ iap, storage, clock, platform, logger })
    const appStoreEnvironment = create.appStoreEnvironment({ appStore, storage, platform })
    const haptics = create.haptics({ ipc, logger })
    const nativeAction = create.nativeAction({ audioRecorder, clock, platform, logger })
    return {
      haptics,
      subscription,
      appStoreEnvironment,
      paywall: create.paywall({
        subscription,
        classicAccess,
        appStoreEnvironment,
        iap,
        appStore,
        platform,
        storage,
      }),
      mobileAudioMemo: create.mobileAudioMemo({
        audioMemo,
        audioRecorder,
        nativeAction,
        lifecycle,
        haptics,
        platform,
        logger,
      }),
    }
  }
  const noteFile = create.noteFile({ ipc, clock, fileChanges })
  const assetStore = create.assetStore({ ipc, clock, fileChanges })
  const openDocuments = create.openDocuments({ fileChanges })
  const indexReads = create.indexReads({ database, noteFile })
  const hash = adapters.hash ?? createWebCryptoHashService()
  const indexStore = create.indexStore({ ipc, database })
  const xArchive = create.xArchive({ ipc })
  const commands = create.commands({ platform, logger })
  const aiCredentials = create.aiCredentials({ secretStore })
  const aiKeyValidation = create.aiKeyValidation({ http: adapters.http })
  const languageModel = create.languageModel({ http: adapters.http, sdk: createLazyAiSdkLoader() })
  const aiProviderConfig = create.aiProviderConfig({
    settings,
    credentials: aiCredentials,
    keyValidation: aiKeyValidation,
    id,
  })
  const noteServices = create.noteServices({ noteFile, wikiResolver: indexReads.wikiResolver, id })
  const calendar = create.calendar({ ipc, logger })
  const contacts = create.contacts({ ipc, logger })
  const personNotes = create.personNotes({
    database,
    wikiResolver: indexReads.wikiResolver,
    noteCreation: noteServices.noteCreation,
  })
  const path = create.path({ transport: adapters.path })
  const mobileStorage = create.mobileStorage({ ipc })
  const noteDocuments = create.noteDocuments({ openDocuments, noteFile })
  const noteMove = create.noteMove({ ipc, indexStore, openDocuments, logger })
  const captureInbox = create.captureInbox({ ipc })
  const webFetch = create.webFetch({ ipc })
  const pageDescriber = create.pageDescriber({ languageModel })
  const reconcilers = create.reconcilers({ lifecycle })
  const assetPrivacy = create.assetPrivacy({
    noteFile,
    xArchive,
    assetReferences: createAssetReferences({ database, xArchive }),
  })
  const assetDescriber = create.assetDescriber({ languageModel })
  const backlinkTarget = create.backlinkTarget({
    noteCreation: noteServices.noteCreation,
    noteFile,
  })
  const indexLifecycle = create.indexLifecycle({
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
    // Read at call time: the graph session is built on this lifecycle.
    graphSession: { getState: () => graphSession.getState() },
  })
  const noteRows = create.noteRows()
  const icloudNative = create.icloudNative({ ipc, logger })
  const graphSession = create.graphSession({
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
    noteRows,
    openDocuments,
    noteMove,
    icloudNative,
    logger,
    createServices: (session, role) =>
      create.graphServices(services, session, role, {
        backups,
        icloudSyncs,
        icloudDownloads,
        capture: services.capture,
        assetDescription: services.assetDescription,
        chatSessions: services.chatSessions,
        attachments,
        settings,
        mobileOnboarding: services.mobileOnboarding,
        graphSession,
        platform,
      }),
  })
  const opener = create.opener({ transport: adapters.opener, logger })
  const navigation = create.navigation()
  const deepLink = create.deepLink({
    // The OS delivers deep links to every webview; only the main window takes them.
    source:
      (windowService.isMainWindow() ? adapters.deepLink : undefined) ?? createNoDeepLinkSource(),
    indexQuery: indexReads.indexQuery,
    captureInbox,
    operations,
    id,
    clock,
    logger,
    graphSession,
  })
  const attachments = create.attachments({
    assetStore,
    noteFile,
    fileChanges,
    dialog: adapters.dialog,
    operations,
    clock,
    platform,
  })
  const persistenceFlush = create.persistenceFlush({
    lifecycle,
    window: windowService,
    platform,
    settings,
    openDocuments,
    logger,
  })
  const gitRepository = create.gitRepository({ ipc })
  const githubAuth = create.githubAuth({ secretStore, http: adapters.http, clock })
  const githubRepos = create.githubRepos({ http: adapters.http })
  const gists = create.gists({ http: adapters.http })
  const syncEngines = create.syncEngines({ git: gitRepository, clock })
  const embeddingRuntime = create.embeddingRuntime({ ipc, logger })
  const retrieval = create.retrieval({
    database,
    search: indexReads.search,
    embeddingRuntime,
    logger,
  })
  const embeddingIndex = create.embeddingIndex({
    ipc,
    embeddingRuntime,
    noteFile,
    database,
    indexLifecycle,
    hash,
    logger,
  })
  const transcription = create.transcription({ http: adapters.http })
  const transcriptEnrichment = create.transcriptEnrichment({ languageModel })
  const audioMemo = create.audioMemo({
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
    graphSession,
    logger,
  })
  const mobileServices = create.mobile({
    platform: adapters.platform,
    build: createMobileServices,
  })
  const chatHistory = create.chatHistory({ ipc, database, logger })
  const dailyNotes = create.dailyNotes({ database, clock, lifecycle })
  const noteTools = create.noteTools({
    retrieval,
    noteFile,
    noteList: indexReads.noteList,
    dailyNotes,
    assetReferences: createAssetReferences({ database, xArchive }),
    assetPrivacy,
    xArchive,
    privacy: noteServices.privacy,
  })
  const chatEngine = create.chatEngine({
    logger,
    languageModel,
    noteTools,
    fitToContextWindow,
  })
  const chatGraphContext = create.chatGraphContext({
    graphStats: indexReads.graphStats,
    privacy: noteServices.privacy,
  })
  const imageCodec = adapters.imageCodec ?? createUnavailableImageCodec()
  const backups = create.backups({
    git: gitRepository,
    syncEngines,
    githubAuth,
    githubRepos,
    fileChanges,
    indexLifecycle,
    operations,
    lifecycle,
    platform,
    persistenceFlush,
    logger,
  })
  const icloudSyncs = create.icloudSyncs({
    icloudNative,
    fileChanges,
    indexLifecycle,
    openDocuments,
    lifecycle,
    clock,
    logger,
  })
  const icloudDownloads = create.icloudDownloads({ icloudNative, lifecycle, clock, logger })
  const services: AppServices = {
    ipc,
    logger,
    clock,
    id,
    hash,
    platform,
    storage,
    dialog: adapters.dialog,
    clipboard: adapters.clipboard,
    opener,
    path,
    window: windowService,
    lifecycle,
    appInfo: create.appInfo({ ipc }),
    calendar,
    calendarEvents: create.calendarEvents({
      calendar,
      settings,
      platform,
      lifecycle,
      logger,
    }),
    contacts,
    contactSuggestions: create.contactSuggestions({
      contacts,
      noteDocuments,
      openDocuments,
      noteFile,
      settings,
      graphSession,
    }),
    meetings: create.meetings({
      noteFile,
      noteCreation: noteServices.noteCreation,
      wikiResolver: indexReads.wikiResolver,
      suggestions: indexReads.suggestions,
      personNotes,
      contacts,
      settings,
      logger,
      graphSession,
    }),
    agentSkill: create.agentSkill({ ipc, graphSession }),
    mobileStorage,
    imageCodec,
    exceptionTelemetry: adapters.exceptionTelemetry ?? createDisabledExceptionTelemetry(),
    operations,
    settings,
    theme: create.theme({ settings, storage, platform }),
    persistenceFlush,
    embeddingRuntime,
    chatHistory,
    navigation,
    deepLink,
    linkNavigation: create.linkNavigation({
      noteLinkResolver: noteServices.noteLinkResolver,
      noteCreation: noteServices.noteCreation,
      wikiResolver: indexReads.wikiResolver,
      window: windowService,
      platform,
      opener,
      deepLink,
      navigation,
      attachments,
      operations,
      logger,
      graphSession,
    }),
    update: create.update({
      updater: adapters.updater,
      clock,
      logger,
      platform,
      window: windowService,
    }),
    githubAuth,
    gistPublish: create.gistPublish({
      gists,
      githubAuth,
      noteDocuments,
      noteRows,
      privacy: noteServices.privacy,
      operations,
      clipboard: adapters.clipboard,
    }),
    icloudNative,
    icloudMigration: create.icloudMigration({ icloudNative, graphSession }),
    conflictResolution: create.conflictResolution({
      noteFile,
      indexLifecycle,
      fileChanges,
      graphSession,
    }),
    syncStatus: create.syncStatus(),
    embedMedia: create.embedMedia({ xArchive, webFetch, platform, clock, logger, graphSession }),
    linkPreview: create.linkPreview({
      noteDocuments,
      privacy: noteServices.privacy,
      webFetch,
      parseMetadata: parseLinkPreviewMeta,
      graphSession,
    }),
    classicAccess,
    fileChanges,
    noteFile,
    attachments,
    noteSessions: create.noteSessions({ noteFile, clock, logger }),
    openDocuments,
    noteMove,
    titleRename: create.titleRename({
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
    keyboard: create.keyboard(),
    share: create.share({ openDocuments }),
    noteDocuments,
    notePreview: create.notePreview({
      noteLinkResolver: noteServices.noteLinkResolver,
      noteDocuments,
      attachments,
    }),
    tasks: create.tasks({ database, noteDocuments, operations, clock, logger }),
    noteActions: create.noteActions({
      noteDocuments,
      noteFile,
      openDocuments,
      indexLifecycle,
      operations,
      clipboard: adapters.clipboard,
      path,
      id,
    }),
    noteRows,
    dailyNotes,
    templates: create.templates({
      noteFile,
      indexQuery: indexReads.indexQuery,
      notePath: indexReads.notePath,
      noteMove,
      openDocuments,
      operations,
    }),
    indexQuery: indexReads.indexQuery,
    backlinks: indexReads.backlinks,
    search: indexReads.search,
    noteList: indexReads.noteList,
    notePath: indexReads.notePath,
    noteCreation: noteServices.noteCreation,
    indexLifecycle,
    graphSession,
    semanticSearch: create.semanticSearch({
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
    mobileOnboarding: create.mobileOnboarding({
      mobileStorage,
      settings,
      graphSession,
      platform,
      clock,
      lifecycle,
      logger,
    }),
    aiPrompts: create.aiPrompts({ settings, id }),
    keymap: create.keymap({ platform }),
    commands,
    nativeMenu: create.nativeMenu({
      commands,
      window: windowService,
      platform,
      ipc,
      logger,
      host: adapters.nativeMenu ?? createUnsupportedNativeMenuHost(),
    }),
    aiProviderConfig,
    selectionTransform: create.selectionTransform({
      logger,
      languageModel,
      providerConfig: aiProviderConfig,
      credentials: aiCredentials,
      privacy: noteServices.privacy,
    }),
    chatSessions: create.chatSessions({
      chatEngine,
      chatHistory,
      chatGraphContext,
      providerConfig: aiProviderConfig,
      credentials: aiCredentials,
      embeddingRuntime,
      settings,
      clock,
      id,
      imageCodec,
      logger,
    }),
    capture: create.capture({
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
    assetDescription: create.assetDescription({
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
      graphSession,
      logger,
    }),
    wikiLinkSuggestions: create.wikiLinkSuggestions({
      suggestions: indexReads.suggestions,
      noteCreation: noteServices.noteCreation,
      contacts,
      personNotes,
      settings,
      clock,
      operations,
      logger,
      graphSession,
    }),
    paletteSearch: create.paletteSearch({
      suggestions: indexReads.suggestions,
      search: indexReads.search,
      retrieval,
      commands,
      clock,
    }),
    mobile: mobileServices,
  }
  const internal: InternalServices = {
    http: adapters.http,
    secretStore,
    personNotes,
    database,
    indexStore,
    gitRepository,
    githubRepos,
    gists,
    syncEngines,
    captureInbox,
    webFetch,
    xArchive,
    audioRecorder,
    webAuth,
    assetStore,
    wikiResolver: indexReads.wikiResolver,
    suggestions: indexReads.suggestions,
    graphStats: indexReads.graphStats,
    noteLinkResolver: noteServices.noteLinkResolver,
    privacy: noteServices.privacy,
    retrieval,
    embeddingIndex,
    aiCredentials,
    aiKeyValidation,
    languageModel,
    pageDescriber,
    assetDescriber,
    transcription,
    transcriptEnrichment,
    noteTools,
    chatEngine,
    chatGraphContext,
    backlinkTarget,
    assetPrivacy,
    backups,
    icloudSyncs,
    icloudDownloads,
  }
  return { services, internal }
}
