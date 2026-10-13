import type { GraphSessionSource } from './graph-session.ts'
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
  type TranscriptionService,
} from '../ai/transcription-service.ts'
import {
  createLanguageModelService,
  createLazyAiSdkLoader,
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
import type { BackupServiceDeps } from '../sync/backup-service.ts'
import {
  createConflictResolutionService,
  type ConflictResolutionService,
} from '../sync/conflict-resolution-service.ts'
import type { ICloudDownloadServiceDeps } from '../sync/icloud-download-service.ts'
import {
  createICloudMigrationService,
  type ICloudMigrationService,
} from '../sync/icloud-migration-service.ts'
import type { ICloudSyncServiceDeps } from '../sync/icloud-sync-service.ts'
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
import { createUpdateService, type UpdaterAdapter, type UpdateService } from './update-service.ts'
import { createWindowService, type WindowHost, type WindowService } from './window-service.ts'
import { createCommandService, type CommandService } from '../commands/command-service.ts'
import { createKeymapService, type KeymapService } from '../commands/keymap-service.ts'
import {
  createPaletteSearchService,
  type PaletteSearchService,
} from '../search/palette-search-service.ts'
import {
  createAutocompleteSuggestionService,
  type AutocompleteSuggestionService,
} from '../search/autocomplete-suggestion-service.ts'
import {
  createNativeMenuService,
  createUnsupportedNativeMenuHost,
  type NativeMenuHost,
  type NativeMenuService,
} from '../commands/native-menu-service.ts'
import { createGraphServices, type GraphServices } from './create-graph-services.ts'
import type { AudioRecorderService } from '../audio/audio-recorder-service.ts'

/**
 * The app-scoped services: one instance each for the lifetime of the webview.
 */
export interface AppServices {
  /**
   * The typed IPC boundary that turns an untyped native response into a validated domain value.
   */
  readonly ipc: IpcBridgeService
  /**
   * Diagnostic logging.
   */
  readonly logger: LoggerService
  /**
   * Wall time, monotonic time, the local date, and timers.
   */
  readonly clock: ClockService
  /**
   * Fresh random identifiers.
   */
  readonly id: IdService
  /**
   * Content hashing.
   */
  readonly hash: HashService
  /**
   * What the host is and can do, plus its reduced-motion and color-scheme signals.
   */
  readonly platform: PlatformService
  /**
   * Key-value storage that outlives a page (`local`) or a session (`session`).
   */
  readonly storage: StorageService
  /**
   * Native open panels.
   */
  readonly dialog: DialogService
  /**
   * The system clipboard.
   */
  readonly clipboard: ClipboardService
  /**
   * Hands URLs and paths to the operating system.
   */
  readonly opener: OpenerService
  /**
   * Host filesystem path building, in the host platform's path syntax.
   */
  readonly path: PathService
  /**
   * Facts about this webview's window and the actions that span windows.
   */
  readonly window: WindowService
  /**
   * Application lifecycle signals and the shell's quit and background-task handshakes.
   */
  readonly lifecycle: AppLifecycleService
  /**
   * Facts about the running application build.
   */
  readonly appInfo: AppInfoService
  /**
   * Live reads of the OS calendar database.
   */
  readonly calendar: CalendarService
  /**
   * The calendar events behind the daily note's events panel, fetched live.
   */
  readonly calendarEvents: CalendarEventsService
  /**
   * Live reads of the OS address book, and the permission state as a store.
   */
  readonly contacts: ContactsService
  /**
   * Offers the Apple Contact whose name matches a note's title as a suggested-contact card.
   */
  readonly contactSuggestions: ContactSuggestionService
  /**
   * Adds a calendar event to its daily note, with the attendee resolution around it.
   */
  readonly meetings: MeetingService
  /**
   * Manages the open graph's agent skill file under `~/.agents/skills/`.
   */
  readonly agentSkill: AgentSkillService
  /**
   * The native side of mobile graph storage.
   */
  readonly mobileStorage: MobileStorageService
  /**
   * Decodes and re-encodes image files.
   */
  readonly imageCodec: ImageCodecService
  /**
   * Exception-only crash reporting.
   */
  readonly exceptionTelemetry: ExceptionTelemetryService
  /**
   * The app-wide list of visible background operations.
   */
  readonly operations: OperationsService
  /**
   * The global settings document: loaded once, patched in memory, and saved one write at a time.
   */
  readonly settings: SettingsService
  /**
   * The app theme: the `theme` setting resolved against the system color scheme.
   */
  readonly theme: ThemeService
  /**
   * Lands dirty state before the app exits or the OS suspends it.
   */
  readonly persistenceFlush: PersistenceFlushService
  /**
   * One stream of "files changed" for the open graph, merging native watcher events with in-process batches.
   */
  readonly fileChanges: FileChangeService
  /**
   * The local embedding model: download, load, status, and text vectors.
   */
  readonly embeddingRuntime: EmbeddingRuntimeService
  /**
   * The graph's persisted chat conversations.
   */
  readonly chatHistory: ChatHistoryService
  /**
   * Checks for, downloads, and installs app updates.
   */
  readonly update: UpdateService
  /**
   * The webview's navigation history; a note window has its own webview, hence its own.
   */
  readonly navigation: NavigationService
  /**
   * The `reflect://` intake of this webview and the handler behind it.
   */
  readonly deepLink: DeepLinkService
  /**
   * Turns an activated link into a navigation, a new window, or a refusal.
   */
  readonly linkNavigation: LinkNavigationService
  /**
   * The one GitHub sign-in of this machine, kept in the keychain.
   */
  readonly githubAuth: GithubAuthService
  /**
   * Publishes a note as a secret GitHub gist, and takes it down again.
   */
  readonly gistPublish: GistPublishService
  /**
   * The native side of the iCloud Drive container.
   */
  readonly icloudNative: ICloudNativeService
  /**
   * Moves a local graph into the iCloud Drive container.
   */
  readonly icloudMigration: ICloudMigrationService
  /**
   * Resolves the sync conflict markers of one note as raw-text surgery.
   */
  readonly conflictResolution: ConflictResolutionService
  /**
   * Derives the mobile sync status that the settings sheet and the status pill show.
   */
  readonly syncStatus: SyncStatusService
  /**
   * The embedded media of the editor's cards: X posts and YouTube videos.
   */
  readonly embedMedia: EmbedMediaService
  /**
   * The privacy-gated expansion of the HTTP(S) links in a note.
   */
  readonly linkPreview: LinkPreviewService
  /**
   * Reflect Open access through a paid Reflect Classic account.
   */
  readonly classicAccess: ClassicAccessService
  /**
   * Resolves, displays, opens, and saves note attachments.
   */
  readonly attachments: AttachmentService
  /**
   * Creates the document session of each open note.
   */
  readonly noteSessions: NoteSessionService
  /**
   * The open note documents, as one app-global registry.
   */
  readonly openDocuments: OpenDocumentsService
  /**
   * Moves note files, and tells the rest of the app that a note now lives somewhere else.
   */
  readonly noteMove: NoteMoveService
  /**
   * Keeps inbound links, aliases and filenames following each note's settled title.
   */
  readonly titleRename: TitleRenameService
  /**
   * Reads and writes a note from an in-app action through the open session when there is one, otherwise the disk.
   */
  readonly noteDocuments: NoteDocumentService
  /**
   * Read-only previews of the note that a link points at.
   */
  readonly notePreview: NotePreviewService
  /**
   * Reads, edits and adds round-checkbox tasks across notes.
   */
  readonly tasks: TaskService
  /**
   * The user's actions on one note that are not edits: pin, private, trash, copy deep link, copy path.
   */
  readonly noteActions: NoteActionsService
  /**
   * The optimistic read overlay for note index rows.
   */
  readonly noteRows: NoteRowService
  /**
   * The date questions about notes: today, which days have a daily note, and the wake onto a new day.
   */
  readonly dailyNotes: DailyNoteService
  /**
   * Note templates: read, insert, create, and manage the Markdown files under `templates/`.
   */
  readonly templates: TemplateService
  /**
   * Row lookups over the index's `notes` and `aliases` tables.
   */
  readonly indexQuery: IndexQueryService
  /**
   * Incoming links of a note, raw or with their rendered block context.
   */
  readonly backlinks: BacklinkService
  /**
   * The palette's full-text search with filters.
   */
  readonly search: SearchService
  /**
   * The All Notes list, the recent-notes listing and the tag facets.
   */
  readonly noteList: NoteListService
  /**
   * Readable, collision-free paths for note and template titles.
   */
  readonly notePath: NotePathService
  /**
   * Creates notes with a title-derived filename and a ULID frontmatter `id`.
   */
  readonly noteCreation: NoteCreationService
  /**
   * The active graph's index lifecycle: open, reconcile, watch, suspend, resume, and rebuild.
   */
  readonly indexLifecycle: IndexLifecycleService
  /**
   * The active graph; its state carries the graph-scoped services of the open session.
   */
  readonly graphSession: GraphSessionService<GraphServices>
  /**
   * The opt-in local semantic search: model download, load, and re-embedding after an index rebuild.
   */
  readonly semanticSearch: SemanticSearchService
  /**
   * The mobile graph bootstrap into one of two fixed roots, the iCloud Drive container or the app sandbox.
   */
  readonly mobileOnboarding: MobileOnboardingService
  /**
   * The software keyboard's overlap height, as the UI last measured it.
   */
  readonly keyboard: KeyboardService
  /**
   * Shares a note through the OS share sheet.
   */
  readonly share: ShareService
  /**
   * The saved AI prompts of the editor AI menu's user library.
   */
  readonly aiPrompts: AiPromptService
  /**
   * The central keymap registry that rejects duplicate shortcut bindings.
   */
  readonly keymap: KeymapService
  /**
   * The command registry. The app decides the context type that its commands run with.
   */
  readonly commands: CommandService
  /**
   * The native macOS application menu and native context menus.
   */
  readonly nativeMenu: NativeMenuService
  /**
   * The configured AI provider entries, and which entry each AI feature uses.
   */
  readonly aiProviderConfig: AiProviderConfigService
  /**
   * Runs a prompt on an editor selection and streams the replacement text.
   */
  readonly selectionTransform: SelectionTransformService
  /**
   * Creates the chat session of an open graph; the workspace owns the session.
   */
  readonly chatSessions: ChatSessionService
  /**
   * Lands the link captures spooled by the browser extension, the iOS share extension, Shortcuts and deep links in the daily note.
   */
  readonly capture: CaptureService
  /**
   * Segmented audio memos: saved raw, transcribed in the background, and linked from the daily note.
   */
  readonly audioMemo: AudioMemoService
  /**
   * Generates managed Markdown descriptions of eligible image and PDF assets, and folds them into search.
   */
  readonly assetDescription: AssetDescriptionService
  /**
   * The editor's `[[` and `#` menus.
   */
  readonly autocompleteSuggestions: AutocompleteSuggestionService
  /**
   * The command palette's data layer.
   */
  readonly paletteSearch: PaletteSearchService
  /**
   * The services that only a mobile platform builds; `null` elsewhere.
   */
  readonly mobile: MobileServices | null
}

/**
 * The mobile-only services that the app reads.
 */
export interface MobileServices {
  /**
   * The haptic engine.
   */
  readonly haptics: HapticsService
  /**
   * The current App Store subscription, seeded from the last launch.
   */
  readonly subscription: SubscriptionService
  /**
   * The App Store install channel, probed once per launch.
   */
  readonly appStoreEnvironment: AppStoreEnvironmentService
  /**
   * Whether the paywall replaces the app, and the actions that lift it.
   */
  readonly paywall: PaywallService
  /**
   * Native recording sessions end to end: start, stop and save, discard, and exactly-once ingest.
   */
  readonly mobileAudioMemo: MobileAudioMemoService
}

/**
 * The read-only services over the index.
 */
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
  graphSession: GraphSessionSource
}): IndexReadServices {
  const { database, noteFile, graphSession } = deps
  const wikiResolver = createWikiResolverService({ database })
  return {
    indexQuery: createIndexQueryService({ database }),
    wikiResolver,
    backlinks: createBacklinkService({ database, noteFile, graphSession }),
    search: createSearchService({ database, wikiResolver }),
    suggestions: createSuggestionService({ database }),
    noteList: createNoteListService({ database }),
    graphStats: createGraphStatsService({ database }),
    notePath: createNotePathService({ database, noteFile }),
  }
}

/**
 * The link resolution, note creation and privacy services.
 */
export interface NoteServices {
  readonly noteLinkResolver: NoteLinkResolverService
  readonly noteCreation: NoteCreationService
  readonly privacy: PrivacyService
}

export function createNoteServices(deps: {
  noteFile: NoteFileService
  wikiResolver: WikiResolverService
  id: IdService
  graphSession: GraphSessionSource
}): NoteServices {
  const { noteFile, wikiResolver, id, graphSession } = deps
  const noteLinkResolver = createNoteLinkResolverService({ wikiResolver, noteFile })
  return {
    noteLinkResolver,
    noteCreation: createNoteCreationService({ noteFile, noteLinkResolver, id }),
    privacy: createPrivacyService({ noteFile, graphSession }),
  }
}

/**
 * The host primitives that {@link createAppServices} builds the services on.
 */
export interface AppAdapters {
  /**
   * The raw IPC transport that the host implements.
   */
  readonly ipc: IpcBridge
  /**
   * What the host is and can do, decided once at startup.
   */
  readonly platform: PlatformFacts
  /**
   * Outbound HTTP, in the shape of the global `fetch`.
   */
  readonly http: HttpService
  /**
   * The Web storage areas; `null` keeps an area in memory.
   */
  readonly storage: { readonly local: Storage | null; readonly session: Storage | null }
  /**
   * Native open panels.
   */
  readonly dialog: DialogService
  /**
   * The system clipboard.
   */
  readonly clipboard: ClipboardService
  /**
   * The native operations behind the opener service.
   */
  readonly opener: OpenerTransport
  /**
   * The native operations behind the path service.
   */
  readonly path: PathTransport
  /**
   * The native window operations behind the window service.
   */
  readonly window: WindowHost
  /**
   * The DOM behind the lifecycle service.
   */
  readonly lifecycle: LifecycleDomAdapter
  /**
   * Defaults to the console.
   */
  readonly logger?: LoggerService
  /**
   * Defaults to the system clock.
   */
  readonly clock?: ClockService
  /**
   * Defaults to the system `IdService`.
   */
  readonly id?: IdService
  /**
   * Defaults to Web Crypto.
   */
  readonly hash?: HashService
  /**
   * Defaults to a codec that cannot decode.
   */
  readonly imageCodec?: ImageCodecService
  /**
   * Defaults to telemetry that reports nothing.
   */
  readonly exceptionTelemetry?: ExceptionTelemetryService
  /**
   * The native updater; without one, updates are unsupported.
   */
  readonly updater?: UpdaterAdapter
  /**
   * The native menus; without a host, every menu operation rejects.
   */
  readonly nativeMenu?: NativeMenuHost
  /**
   * Defaults to the URL shape of Apple webviews.
   */
  readonly convertFileSrc?: FileSrcConverter
  /**
   * The system's `reflect://` delivery; without one, no URL arrives.
   */
  readonly deepLink?: DeepLinkSource
}

/**
 * Builds the mobile services on a mobile platform only.
 */
function createMobileServices(deps: {
  platform: PlatformFacts
  build: () => MobileServices
}): MobileServices | null {
  return isMobilePlatform(deps.platform.appPlatform) || deps.platform.surface.mobileApp
    ? deps.build()
    : null
}

/**
 * The factory of every service {@link createAppServices} builds, by key.
 */
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
  languageModel: createLanguageModelService,
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
  graphSession: createGraphSessionService<GraphServices>,
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
  transcription: createTranscriptionService,
  transcriptEnrichment: createTranscriptEnrichmentService,
  audioMemo: createAudioMemoService,
  mobile: createMobileServices,
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
  update: createUpdateService,
  gistPublish: createGistPublishService,
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
  autocompleteSuggestions: createAutocompleteSuggestionService,
  paletteSearch: createPaletteSearchService,
}

/**
 * The factory of each service key; a replacement gets the same dependencies.
 */
export type ServiceFactories = typeof appServiceFactories

/**
 * The services that {@link createAppServices} builds but keeps out of {@link AppServices}.
 */
export interface InternalServices {
  /**
   * Outbound HTTP, in the shape of the global `fetch`.
   */
  readonly http: HttpService
  /**
   * The OS keychain behind every credential.
   */
  readonly secretStore: SecretStoreService
  /**
   * The mapping from email identities to `#person` notes.
   */
  readonly personNotes: PersonNoteService
  /**
   * Typed read-only queries over the active graph's SQLite index.
   */
  readonly database: DatabaseService
  /**
   * The SQLite projection of the active graph, written through the native `index_*` commands.
   */
  readonly indexStore: IndexStoreService
  /**
   * The Rust git primitives for the open graph's repository.
   */
  readonly gitRepository: GitRepositoryService
  /**
   * The backup repository on GitHub, over its REST API.
   */
  readonly githubRepos: GithubRepoService
  /**
   * The GitHub Gists REST surface behind "Publish to gist".
   */
  readonly gists: GistService
  /**
   * Builds the sync engine of one graph session.
   */
  readonly syncEngines: SyncEngineFactory
  /**
   * The capture inbox of envelopes that the browser extension, the iOS share extension, and deep links spool.
   */
  readonly captureInbox: CaptureInboxService
  /**
   * Bounded outbound web fetches that the native side performs.
   */
  readonly webFetch: WebFetchService
  /**
   * X (Twitter) posts and their media archived under `assets/x/`.
   */
  readonly xArchive: XArchiveService
  /**
   * The microphone recorder behind audio memos.
   */
  readonly audioRecorder: AudioRecorderService
  /**
   * The system web sign-in session.
   */
  readonly webAuth: WebAuthService
  /**
   * Binary files in the graph: attachments, audio memos, and the transcript cache.
   */
  readonly assetStore: AssetStoreService
  /**
   * Reads and writes Markdown notes by graph-relative path.
   */
  readonly noteFile: NoteFileService
  /**
   * Wiki-target resolution over the index's claims and keys.
   */
  readonly wikiResolver: WikiResolverService
  /**
   * Autocomplete candidates for `#` tags and `[[` wiki targets.
   */
  readonly suggestions: SuggestionService
  /**
   * Graph-level aggregates over the non-private notes.
   */
  readonly graphStats: GraphStatsService
  /**
   * Decides which existing note a `[[wiki link]]` or Markdown href points at.
   */
  readonly noteLinkResolver: NoteLinkResolverService
  /**
   * The `private: true` gate that every outbound payload passes through.
   */
  readonly privacy: PrivacyService
  /**
   * The one retrieval contract that search and AI share.
   */
  readonly retrieval: RetrievalService
  /**
   * Keeps each note's chunk vectors current.
   */
  readonly embeddingIndex: EmbeddingIndexService
  /**
   * The BYOK API key of each configured AI provider entry.
   */
  readonly aiCredentials: AiCredentialService
  /**
   * Checks a BYOK key with one cheap authenticated probe before it is saved.
   */
  readonly aiKeyValidation: AiKeyValidationService
  /**
   * Turns a configured BYOK entry and its key into a callable language model.
   */
  readonly languageModel: LanguageModelService
  /**
   * One multimodal call that cleans a captured page's title and describes the page.
   */
  readonly pageDescriber: PageDescriberService
  /**
   * One multimodal call that describes an image, PDF or SVG and transcribes its text.
   */
  readonly assetDescriber: AssetDescriberService
  /**
   * Speech to text for one recording.
   */
  readonly transcription: TranscriptionService
  /**
   * Best-effort formatting and titling of a transcript after transcription.
   */
  readonly transcriptEnrichment: TranscriptEnrichmentService
  /**
   * The read-only tools that the chat model can call, with the privacy gate inside.
   */
  readonly noteTools: NoteToolsService
  /**
   * Runs tool-grounded chat turns against the user's provider.
   */
  readonly chatEngine: ChatEngineService
  /**
   * Loads the graph overview that a chat turn's system prompt carries.
   */
  readonly chatGraphContext: ChatGraphContextService
  /**
   * The category notes that automatic backlinks point at.
   */
  readonly backlinkTarget: BacklinkTargetService
  /**
   * The verdict on whether an asset's bytes may be sent to a provider.
   */
  readonly assetPrivacy: AssetPrivacyService
}

export function createAppServices(
  adapters: AppAdapters,
  factories?: Partial<ServiceFactories>,
): AppServices {
  return composeAppServices(adapters, factories).services
}

/**
 * {@link createAppServices}, plus the services it keeps internal.
 */
export function composeAppServices(
  adapters: AppAdapters,
  factories?: Partial<ServiceFactories>,
): { services: AppServices; internal: InternalServices } {
  const create: ServiceFactories = { ...appServiceFactories, ...factories }
  const logger = adapters.logger ?? createConsoleLogger()
  const clock = adapters.clock ?? createSystemClock()
  const ipc = create.ipc({ transport: adapters.ipc, logger })
  const database = create.database({ ipc })
  const platform = create.platform({ facts: adapters.platform, fileSrc: adapters.convertFileSrc })
  const windowService = create.window({ ipc, host: adapters.window, logger })
  const operations = create.operations({ clock })
  const settings = create.settings({ ipc, operations })
  const storage = create.storage({
    logger,
    localStorage: adapters.storage.local,
    sessionStorage: adapters.storage.session,
  })
  const lifecycle = create.lifecycle({ ipc, dom: adapters.lifecycle, clock, logger })
  const fileChanges = create.fileChanges({
    ipc,
    logger,
    echoOwnWrites: isMobilePlatform(adapters.platform.appPlatform),
  })
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
  const buildMobileServices = (): MobileServices => {
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
  const indexReads = create.indexReads({
    database,
    noteFile,
    // Read at call time: the graph session is built later.
    graphSession: { getState: () => graphSession.getState() },
  })
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
  const noteServices = create.noteServices({
    noteFile,
    wikiResolver: indexReads.wikiResolver,
    id,
    // Read at call time: the graph session is built later.
    graphSession: { getState: () => graphSession.getState() },
  })
  const calendar = create.calendar({ ipc, logger })
  const contacts = create.contacts({ ipc, logger })
  const personNotes = create.personNotes({
    database,
    wikiResolver: indexReads.wikiResolver,
    noteCreation: noteServices.noteCreation,
  })
  const path = create.path({ transport: adapters.path })
  const mobileStorage = create.mobileStorage({ ipc })
  const noteDocuments = create.noteDocuments({
    openDocuments,
    noteFile,
    // Read at call time: the graph session is built later.
    graphSession: { getState: () => graphSession.getState() },
  })
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
  const noteRows = create.noteRows({
    // Read at call time: the graph session is built on these rows.
    graphSession: {
      getState: () => graphSession.getState(),
      subscribe: (listener) => graphSession.subscribe(listener),
    },
  })
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
      create.graphServices(session, role, {
        backup: backupDeps,
        icloudSync: icloudSyncDeps,
        icloudDownload: icloudDownloadDeps,
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
    graphSession,
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
    build: buildMobileServices,
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
  const backupDeps: BackupServiceDeps = {
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
  }
  const icloudSyncDeps: ICloudSyncServiceDeps = {
    icloudNative,
    fileChanges,
    indexLifecycle,
    openDocuments,
    lifecycle,
    clock,
    logger,
  }
  const icloudDownloadDeps: ICloudDownloadServiceDeps = { icloudNative, lifecycle, clock, logger }
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
      graphSession,
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
    attachments,
    noteSessions: create.noteSessions({ noteFile, clock, logger, graphSession }),
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
      graphSession,
    }),
    keyboard: create.keyboard(),
    share: create.share({ openDocuments }),
    noteDocuments,
    notePreview: create.notePreview({
      noteLinkResolver: noteServices.noteLinkResolver,
      noteDocuments,
      attachments,
      graphSession,
    }),
    tasks: create.tasks({
      database,
      noteDocuments,
      operations,
      clock,
      logger,
      graphSession,
      indexLifecycle,
      window: windowService,
    }),
    noteActions: create.noteActions({
      noteDocuments,
      noteFile,
      openDocuments,
      indexLifecycle,
      indexQuery: indexReads.indexQuery,
      noteRows,
      operations,
      clipboard: adapters.clipboard,
      path,
      id,
      graphSession,
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
      graphSession,
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
    autocompleteSuggestions: create.autocompleteSuggestions({
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
    noteFile,
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
  }
  return { services, internal }
}
