/**
 * Test doubles for `@reflect/core` services. Each `createTestXxxService()`
 * returns an in-memory implementation of the matching service interface plus
 * observation helpers. Apps import this module in tests only.
 */
export {
  createTestHashService,
  createTestIdService,
  type TestHashService,
  type TestIdService,
} from './id.ts'
export { createTestLoggerService, type LogEntry, type TestLoggerService } from './logger.ts'
export { createTestClockService, type TestClockService } from './clock.ts'
export {
  createTestIpcBridgeService,
  installTestBridge,
  type TestIpcBridgeService,
  type TestIpcBridgeServiceOptions,
} from './ipc.ts'
export {
  createTestClipboardService,
  createTestDialogService,
  createTestLifecycleService,
  createTestOpenerService,
  createTestPathService,
  createTestWindowService,
  installTestShellServices,
  type DialogCall,
  type TestClipboardService,
  type TestDialogService,
  type TestLifecycleService,
  type TestOpenerService,
  type TestWindowService,
} from './shell.ts'
export {
  createTestPlatformService,
  type TestPlatformOptions,
  type TestPlatformService,
} from './platform.ts'
export {
  createTestHttpService,
  type TestHttpHandler,
  type TestHttpMatcher,
  type TestHttpReply,
  type TestHttpRequest,
  type TestHttpRoute,
  type TestHttpService,
} from './http.ts'
export { createTestStorageService, type TestStorageService } from './storage.ts'
export {
  createTestAppServices,
  createTestGraphServices,
  installTestServices,
  type TestAppServices,
  type TestGraphServices,
} from './services.ts'
export {
  createTestCalendarService,
  type TestCalendarService,
  type TestCalendarServiceOptions,
} from './calendar.ts'
export {
  createTestContactsService,
  type ContactsLookup,
  type TestContactsService,
  type TestContactsServiceOptions,
} from './contacts.ts'
export {
  createTestDatabaseService,
  seedNotes,
  type TestDatabaseQuery,
  type TestDatabaseService,
  type TestNote,
} from './database.ts'
export {
  createTestEmbeddingRuntimeService,
  type TestEmbeddingRuntimeService,
  type TestEmbeddingRuntimeServiceOptions,
} from './embeddings.ts'
export {
  createTestChatHistoryService,
  type TestChatConversation,
  type TestChatHistoryService,
  type TestChatHistoryServiceOptions,
} from './chat.ts'
export { createTestAgentSkillService, type TestAgentSkillService } from './agent-skill.ts'
export {
  createTestMobileStorageService,
  type TestMobileStorageService,
  type TestMobileStorageServiceOptions,
} from './mobile-storage.ts'
export {
  createTestImageCodec,
  type TestImageCodecService,
  type TestImageEncode,
  type TestImageSize,
} from './image-codec.ts'
export {
  createTestExceptionTelemetry,
  type ExceptionReport,
  type ExceptionReportSource,
  type TestExceptionTelemetryService,
} from './exception-telemetry.ts'
export {
  createTestCaptureInboxService,
  createTestWebFetchService,
  createTestXArchiveService,
  type TestCaptureInboxService,
  type TestWebFetchService,
  type TestXArchiveService,
  type WebFetchKind,
} from './capture.ts'
export {
  createTestGistService,
  createTestGitHostCredentialService,
  createTestGitRepositoryService,
  createTestGithubAuthService,
  createTestGithubRepoService,
  createTestICloudNativeService,
  type GitRepositoryCall,
  type GitRepositoryHandler,
  type ICloudNativeCall,
  type TestGitRepositoryService,
  type TestGithubAuthOptions,
  type TestICloudNativeService,
} from './sync.ts'
export {
  createTestAiCredentialService,
  createTestAiKeyValidationService,
  createTestAiPromptService,
  createTestAiProviderConfigService,
  createTestAssetDescriberService,
  createTestPageDescriberService,
  createTestSelectionTransformService,
  createTestTranscriptEnrichmentService,
  createTestTranscriptionService,
  createTestLanguageModelService,
  type TestAiCredentialServiceOptions,
  type TestAiKeyValidationService,
  type TestAiPromptServiceOptions,
  type TestAiProviderConfigServiceOptions,
  type TestAssetDescriberService,
  type TestAssetDescriberSource,
  type TestPageDescriberService,
  type TestPageDescriberSource,
  type TestSelectionTransformServiceOptions,
  type TestTranscriptEnrichmentServiceOptions,
  type TestTranscriptionService,
  type TestTranscriptionSource,
  type TestLanguageModelCall,
  type TestLanguageModelService,
  type TestLanguageModelSource,
} from './ai.ts'
export {
  createTestAppInfoService,
  createTestSecretStoreService,
  type TestSecretStoreService,
} from './secrets.ts'
export {
  createTestIndexStoreService,
  type IndexStoreCall,
  type TestIndexStoreService,
  type TestIndexStoreServiceOptions,
} from './index-store.ts'
export {
  createTestGraphSessionService,
  type TestGraphSessionService,
  type TestGraphSessionServiceOptions,
} from './graph-session.ts'
export { createTestV1ImportService } from './v1-import.ts'
export { createTestKeyboardService, createTestShareService } from './mobile.ts'
export {
  createTestMobileOnboardingService,
  type TestMobileOnboardingService,
  type TestMobileOnboardingServiceOptions,
} from './mobile-onboarding.ts'
export {
  createTestIndexLifecycleService,
  type TestIndexLifecycleService,
  type TestIndexLifecycleServiceOptions,
} from './index-lifecycle.ts'
export {
  createTestOperationsService,
  type OperationSnapshot,
  type TestOperationsService,
} from './operations.ts'
export { createTestSettingsService, type TestSettingsService } from './settings.ts'
export { createTestThemeService, type TestThemeService } from './theme.ts'
export {
  createTestPersistenceFlushService,
  type TestPersistenceFlushService,
} from './persistence-flush.ts'
export {
  createTestFileChangeService,
  type TestFileChangeService,
  type TestFileChangeServiceOptions,
} from './file-change.ts'
export {
  createTestUpdateService,
  createTestUpdaterAdapter,
  type TestUpdateCall,
  type TestUpdaterAdapter,
  type TestUpdaterCall,
  type TestUpdaterOptions,
  type TestUpdateService,
} from './update.ts'
export {
  createTestAppStoreService,
  createTestHapticsService,
  createTestIapService,
  createTestWebAuthService,
  type AppStoreCall,
  type TestAppStoreService,
  type TestHapticsService,
  type TestIapService,
  type TestWebAuthService,
} from './plugins.ts'
export {
  createTestAudioRecorderService,
  type AudioRecorderCall,
  type TestAudioRecorderService,
} from './audio-recorder.ts'
export {
  createTestAssetStoreService,
  createTestNoteCreationService,
  createTestNoteFileService,
  createTestNoteLinkResolverService,
  type AssetUpload,
  type NoteFileWrite,
  type NoteLinkResolution,
  type TestAssetStoreService,
  type TestAssetStoreServiceOptions,
  type TestNoteCreationService,
  type TestNoteCreationServiceOptions,
  type TestNoteFileService,
  type TestNoteFileServiceOptions,
  type TestNoteLinkResolverService,
  type TestNoteLinkResolverServiceOptions,
} from './graph.ts'
export {
  createTestPrivacyService,
  type TestPrivacyService,
  type TestPrivacyServiceOptions,
} from './privacy.ts'
export {
  createTestDeepLinkService,
  createTestDeepLinkSource,
  createTestNavigationService,
  type TestDeepLinkService,
  type TestDeepLinkServiceOptions,
  type TestDeepLinkSource,
  type TestNavigateCall,
  type TestNavigationService,
  type TestNavigationServiceOptions,
} from './navigation.ts'
export {
  createTestAttachmentService,
  type AttachmentSave,
  type TestAttachmentEntry,
  type TestAttachmentService,
  type TestAttachmentServiceOptions,
} from './attachments.ts'
export {
  createTestNoteActionsService,
  createTestNoteDocumentService,
  createTestNoteSession,
  createTestNoteSessionService,
  createTestOpenDocumentsService,
  type NoteSessionCall,
  type TestNoteActionsService,
  type TestNoteActionsServiceOptions,
  type TestNoteDocumentServiceOptions,
  type TestNoteSession,
  type TestNoteSessionOptions,
  type TestNoteSessionService,
  type TestNoteSessionServiceOptions,
} from './documents.ts'
export {
  createTestAppStoreEnvironmentService,
  createTestClassicAccessService,
  createTestPaywallService,
  createTestSubscriptionService,
  type AppStoreEnvironmentCall,
  type ClassicAccessCall,
  type PaywallAction,
  type SubscriptionCall,
  type TestAppStoreEnvironmentService,
  type TestClassicAccessService,
  type TestPaywallService,
  type TestSubscriptionService,
} from './monetization.ts'
export {
  createTestCommandService,
  createTestKeymapService,
  createTestNativeMenuHost,
  createTestNativeMenuService,
  type TestNativeMenuHost,
  type TestNativeMenuHostCall,
  type TestNativeMenuService,
  type TestNativeMenuServiceOptions,
} from './commands.ts'
