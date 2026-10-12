export {
  setBridge,
  hasBridge,
  subscribeBridgeChanges,
  defaultIpc,
  currentIpc,
  type IpcBridge,
  type Unlisten,
} from '../ipc/bridge.ts'
export { createIpcBridgeService, listenNow, type IpcBridgeService } from '../ipc/ipc-service.ts'
export { call, callBinary } from '../ipc/invoke.ts'
export { type PluginSubscription } from '../ipc/plugin.ts'
export {
  actionPerformed,
  actionsReady,
  cancelRecording,
  deleteStaged,
  listStaged,
  recordingStatus,
  startRecording,
  stopRecording,
  subscribeRecordingLevel,
  subscribeRecordingNativeAction,
  subscribeRecordingSegment,
  subscribeRecordingStopped,
  type RecordingLevelEvent,
  type RecordingNativeActionEvent,
  type RecordingSegmentEvent,
  type RecordingSessionStart,
  type RecordingStatus,
  type RecordingStopResponse,
  type RecordingStoppedEvent,
  type StagedRecordingFile,
  type StartRecordingOptions,
} from '../ipc/recording-plugin.ts'
export { impactLight } from '../ipc/mobile-haptics-plugin.ts'
export {
  getAppVersion,
  mobileStorage,
  mobileStorageLocal,
  icloudDownloadPending,
  icloudPendingCount,
  icloudRequestDownloads,
  icloudStatus,
  icloudAdoptGraph,
  icloudConflictsScan,
  mergeText,
  type MergeTextOutcome,
  icloudWatchStart,
  icloudWatchStop,
  type IcloudDownloadScope,
  type IcloudScanOptions,
  type IcloudSweepScope,
  type IcloudStatus,
  type IcloudSweepOutcome,
  type MobileStorageInfo,
  type MobileStorageKind,
} from '../ipc/commands.ts'
export { isMobilePlatform, type AppPlatform } from '../app/platform.ts'
export {
  createSystemClock,
  defaultClock,
  setDefaultClock,
  type ClockService,
  type TimerHandle,
} from '../app/clock-service.ts'
export { parseIsoDate, todayIso } from '../lib/dates.ts'
export {
  createPlatformService,
  defaultPlatform,
  platformFacts,
  setDefaultPlatform,
  type ColorScheme,
  type PlatformFacts,
  type PlatformMedia,
  type PlatformService,
  type PlatformSurface,
} from '../app/platform-service.ts'
export { confirmQuit, subscribeQuitRequested } from '../app/quit.ts'
export {
  beginBackgroundTask,
  endBackgroundTask,
  type BackgroundTaskToken,
} from '../app/background-task.ts'
export { WINDOW_NAVIGATE_EVENT, subscribeWindowNavigate } from '../app/window-events.ts'
export { toggleDevtools } from '../app/devtools.ts'
export {
  defaultDialog,
  setDefaultDialog,
  type DialogFilter,
  type DialogService,
  type PickFilesOptions,
  type PickFolderOptions,
} from '../app/dialog-service.ts'
export {
  defaultClipboard,
  setDefaultClipboard,
  type ClipboardService,
} from '../app/clipboard-service.ts'
export {
  createOpenerService,
  defaultOpener,
  setDefaultOpener,
  type OpenerService,
  type OpenerTransport,
  type SystemSettingsPane,
} from '../app/opener-service.ts'
export {
  createPathService,
  createPosixPathTransport,
  defaultPath,
  setDefaultPath,
  type PathService,
  type PathTransport,
} from '../app/path-service.ts'
export {
  MAIN_WINDOW_LABEL,
  createSingleWindowHost,
  createWindowService,
  defaultWindow,
  setDefaultWindow,
  type CloseRequestedEvent,
  type CloseRequestedHandler,
  type WindowHost,
  type WindowService,
} from '../app/window-service.ts'
export {
  RESUME_THROTTLE_MS,
  createDetachedLifecycleDom,
  createLifecycleService,
  defaultLifecycle,
  setDefaultLifecycle,
  type AppLifecycleService,
  type LifecycleDomAdapter,
  type LifecyclePageEvent,
} from '../app/lifecycle-service.ts'
export { createSystemIdService, type IdService, type PkcePair } from '../app/id-service.ts'
export { createWebCryptoHashService, type HashService } from '../app/hash-service.ts'
export {
  createConsoleLogger,
  defaultLogger,
  setDefaultLogger,
  type LoggerService,
} from '../app/logger-service.ts'
export {
  createBackgroundReconcilerFactory,
  defaultBackgroundReconcilerFactory,
  setDefaultBackgroundReconcilerFactory,
  type BackgroundReconciler,
  type BackgroundReconcilerFactory,
  type BackgroundReconcilerOptions,
  type ReconcilePass,
} from '../app/background-reconciler.ts'
export {
  createUnavailableImageCodec,
  defaultImageCodec,
  setDefaultImageCodec,
  type DecodedImage,
  type ImageCodecService,
  type ImageEncodeOptions,
} from '../app/image-codec-service.ts'
export {
  createDisabledExceptionTelemetry,
  defaultExceptionTelemetry,
  setDefaultExceptionTelemetry,
  type ExceptionErrorHandler,
  type ExceptionErrorInfo,
  type ExceptionRootOptions,
  type ExceptionTelemetryService,
} from '../app/exception-telemetry-service.ts'
export {
  createBrowserHttpService,
  defaultHttp,
  setDefaultHttp,
  type HttpService,
} from '../app/http-service.ts'
export {
  createWebStorageService,
  defaultStorage,
  getJson,
  setDefaultStorage,
  setJson,
  type KeyValueStore,
  type StorageService,
} from '../app/storage-service.ts'
export {
  agentSkillStatus,
  agentSkillInstall,
  agentSkillUninstall,
  type AgentSkillInstallState,
  type AgentSkillStatus,
} from '../app/agent-skill.ts'
export {
  createAgentSkillService,
  defaultAgentSkill,
  setDefaultAgentSkill,
  type AgentSkillService,
} from '../app/agent-skill-service.ts'
export {
  createMobileStorageService,
  defaultMobileStorage,
  setDefaultMobileStorage,
  type MobileStorageService,
} from '../ipc/mobile-storage-service.ts'
export {
  createCalendarService,
  defaultCalendar,
  setDefaultCalendar,
  type CalendarRange,
  type CalendarService,
} from '../calendar/calendar-service.ts'
export {
  createContactsService,
  defaultContacts,
  setDefaultContacts,
  type ContactsService,
} from '../contacts/contacts-service.ts'
export { chunkNote, type NoteChunk } from '../embeddings/chunk.ts'
export {
  embedStatus,
  embedEnsure,
  embedTexts,
  embedApply,
  embedRemove,
  subscribeEmbedStatus,
  embedStatusSchema,
  type EmbedStatus,
  type EmbedProgress,
  type EmbedChunkPayload,
} from '../embeddings/commands.ts'
export { embedNote, backfillEmbeddings } from '../embeddings/pipeline.ts'
export {
  retrieve,
  relatedNotes,
  fuseRanked,
  type RetrievalHit,
  type RetrieveOptions,
} from '../embeddings/retrieve.ts'
export {
  appErrorSchema,
  errorMessage,
  isAppError,
  toAppError,
  ReflectError,
  type AppError,
} from '../errors.ts'
export {
  DAILY_DIR,
  NOTES_DIR,
  TEMPLATES_DIR,
  ASSETS_DIR,
  AUDIO_MEMOS_DIR,
  dailyPath,
  notePath,
  templatePath,
  assetPath,
  audioMemoPath,
  descriptionPathFor,
  DESCRIPTION_SUFFIX,
  isDaily,
  isNotePath,
  isAttachmentPath,
  isSafeVisibleGraphPath,
  classifyGraphPath,
  mayContainNotes,
  isTemplatePath,
  dateFromDailyPath,
  foldGraphPath,
  isCalendarDate,
  type GraphPathKind,
} from '../graph/paths.ts'
export {
  createAttachmentCatalog,
  isImageAttachmentPath,
  resolveAttachmentLink,
  resolveWikiEmbedTarget,
  type AttachmentCatalog,
  type WikiEmbedTarget,
} from '../graph/attachment-resolution.ts'
export {
  wikiNoteReference,
  markdownNoteReference,
  noteBasenameKey,
  type NoteReference,
} from '../graph/note-reference.ts'
export {
  isValidReflectNoteId,
  isReflectManagedNotePath,
  isReflectManagedNote,
} from '../graph/note-management.ts'
export {
  graphInfoSchema,
  recentGraphSchema,
  fileMetaSchema,
  noteCreateOutcomeSchema,
  graphImportProgressSchema,
  graphImportSummarySchema,
  windowBootstrapSchema,
  type GraphInfo,
  type RecentGraph,
  type FileMeta,
  type NoteCreateOutcome,
  type GraphImportProgress,
  type GraphImportSummary,
  type WindowBootstrap,
} from '../graph/schemas.ts'
export {
  openGraph,
  windowBootstrap,
  createGraph,
  importReflectV1Zip,
  subscribeImportProgress,
  cancelReflectV1Import,
  markReflectV1ImportOwnWrites,
  readNote,
  readNoteLocal,
  type LocalNoteRead,
  writeNote,
  createNoteIfAbsent,
  writeAsset,
  readAsset,
  openAsset,
  revealAsset,
  listDir,
  noteExists,
  deleteNote,
  deleteAudioMemo,
  importAudioMemo,
  listFiles,
  listAttachments,
  vaultScanStats,
  type VaultScanStats,
  recentGraphs,
  forgetRecent,
  deleteGraph,
  captureHostRegister,
  captureInboxList,
  captureInboxRead,
  captureInboxSpool,
  captureInboxReject,
  captureInboxRemove,
  captureMetaFetch,
  captureSharedInboxRelay,
  promoteCaptureScreenshot,
} from '../graph/commands.ts'
export { fetchYouTubeVideo } from '../youtube-video.ts'
export { createAsset, importAsset } from '../graph/assets.ts'
export { assetFileName } from '../graph/asset-names.ts'
export {
  newNoteId,
  newNoteSource,
  untitledNoteSeed,
  untitledNotePath,
  isUntitledNotePath,
  createNoteWithTitle,
  resolveOrCreateNoteWithTitle,
  type ResolveOrCreateNoteResult,
} from '../graph/create-note.ts'
export {
  resolveExistingMarkdownTarget,
  resolveExistingWikiTarget,
  type ExistingWikiTargetResolution,
} from '../graph/resolve-existing-wiki-target.ts'
export {
  settingsSchema,
  editorMarkdownSyntaxSchema,
  editorSpellCheckSchema,
  editorDefaultBulletSchema,
  editorBulletAfterHeadingSchema,
  editorSmoothCaretAnimationSchema,
  editorTextSizeSchema,
  editorFullWidthSchema,
  sidebarWidthSchema,
  contextSidebarWidthSchema,
  SIDEBAR_WIDTH_RANGE,
  CONTEXT_SIDEBAR_WIDTH_RANGE,
  clampSidebarWidth,
  semanticSearchEnabledSchema,
  describeAssetsSchema,
  transcriptionFormatSchema,
  transcriptionPromptSchema,
  TRANSCRIPTION_PROMPT_MAX_LENGTH,
  normalizeTranscriptionPrompt,
  contactsEnabledSchema,
  themePreferenceSchema,
  timeFormatSchema,
  dateFormatSchema,
  weekStartDaySchema,
  weekStartDow,
  allNotesFilterTagsSchema,
  calendarEnabledSchema,
  calendarIdsSchema,
  graphColorSchema,
  graphColorsSchema,
  GRAPH_COLOR_IDS,
  aiProviderIdSchema,
  openAiCompatibleBaseUrlSchema,
  aiProviderConfigSchema,
  aiProvidersSchema,
  defaultAiProviderIdSchema,
  chatModelSelectionSchema,
  chatSystemPromptSchema,
  CHAT_SYSTEM_PROMPT_MAX_LENGTH,
  normalizeChatSystemPrompt,
  aiPromptModeSchema,
  aiPromptSchema,
  aiPromptsSchema,
  DEFAULT_SETTINGS,
  type Settings,
  type EditorMarkdownSyntax,
  type EditorTextSize,
  type SidebarWidthRange,
  type ThemePreference,
  type TimeFormat,
  type DateFormat,
  type WeekStartDay,
  type AllNotesFilterTags,
  type CalendarIds,
  type GraphColor,
  type GraphColors,
  type AiProviderId,
  type HostedAiProviderId,
  type AiProviderConfig,
  type HostedAiProviderConfig,
  type OpenAiCompatibleProviderConfig,
  type AiPrompt,
  type AiPromptMode,
} from '../settings/schema.ts'
export { loadSettings, saveSettings } from '../settings/commands.ts'
export {
  contactsAuthorizationSchema,
  contactMatchSchema,
  contactsAuthorizationStatus,
  requestContactsAccess,
  lookupContactsByEmail,
  lookupContactsByName,
  isContactsReadable,
  type ContactsAuthorization,
  type ContactMatch,
} from '../contacts/commands.ts'
export {
  contactLinkSuggestions,
  contactNamesEqual,
  matchContactForTitle,
  suggestContactForTitle,
} from '../contacts/match.ts'
export {
  contactDetailsMarkdown,
  appendContactDetails,
  noteHasContactDetails,
} from '../contacts/markdown.ts'
export { pickContactForEmail, resolveAttendeeContact } from '../contacts/resolve.ts'
export {
  ensurePersonNote,
  resolvePerson,
  resolvePersonContact,
  type BlockedPersonResolution,
  type BlockedPersonContactResolution,
  type EnsurePersonNoteInput,
  type EnsurePersonNoteResult,
  type ExistingPersonResolution,
  type ExistingPersonContactResolution,
  type MissingPersonResolution,
  type NewPersonContactResolution,
  type PersonContactResolution,
  type PersonResolution,
} from '../contacts/person.ts'
export {
  CLASSIC_ACCESS_SECRET,
  classicAccessUntil,
  classicPaidThrough,
  clearClassicAccess,
  isClassicAccessActive,
  loadClassicAccess,
  readClassicAccess,
  signInWithClassic,
  type ClassicAccess,
  type ClassicInvoice,
  type ClassicSignInResult,
  type StartWebAuth,
} from '../classic/classic-access.ts'
export {
  IAP_PRODUCT_IDS,
  iapGetProducts,
  iapPurchase,
  iapIsOwned,
  subscribeIapPurchaseUpdated,
  type IapProduct,
} from '../ipc/iap-plugin.ts'
export {
  getAppStoreEnvironment,
  presentOfferCodeRedeemSheet,
  syncAppStore,
} from '../ipc/app-store-plugin.ts'
export { startWebAuth, type WebAuthOptions } from '../ipc/web-auth-plugin.ts'
