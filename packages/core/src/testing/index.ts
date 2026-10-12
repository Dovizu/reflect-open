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
