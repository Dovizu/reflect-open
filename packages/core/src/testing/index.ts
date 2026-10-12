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
  createTestAppInfoService,
  createTestSecretStoreService,
  type TestSecretStoreService,
} from './secrets.ts'
export {
  createTestFileChangeService,
  type TestFileChangeService,
  type TestFileChangeServiceOptions,
} from './file-change.ts'
