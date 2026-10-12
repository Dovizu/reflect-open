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
export { createTestDatabaseService, type TestDatabaseService } from './database.ts'
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
  createTestGitRepositoryService,
  createTestICloudNativeService,
  type GitRepositoryCall,
  type GitRepositoryHandler,
  type ICloudNativeCall,
  type TestGitRepositoryService,
  type TestICloudNativeService,
} from './sync.ts'
export {
  createTestAppInfoService,
  createTestSecretStoreService,
  type TestSecretStoreService,
} from './secrets.ts'
export {
  createTestOperationsService,
  type OperationSnapshot,
  type TestOperationsService,
} from './operations.ts'
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
