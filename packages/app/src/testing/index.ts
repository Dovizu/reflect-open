/**
 * Test doubles for `@reflect/app` services, and `createTestAppServices()`, the
 * app layer built over `createTestCoreServices()`.
 */
export {
  createTestNativeMenuHost,
  createTestNativeMenuService,
  type TestNativeMenuHost,
  type TestNativeMenuHostCall,
  type TestNativeMenuService,
  type TestNativeMenuServiceOptions,
} from './commands.ts'
export { createTestClipboardService, type TestClipboardService } from './clipboard.ts'
export { createTestOpenerService, type TestOpenerService } from './opener.ts'
export { createTestAppHost, createTestAppServices, type TestAppServices } from './services.ts'
export {
  createTestLifecycleService,
  type TestLifecycleService,
  type TestLifecycleServiceOptions,
} from './lifecycle.ts'
export {
  createTestExceptionTelemetry,
  type ExceptionReport,
  type ExceptionReportSource,
  type TestExceptionTelemetryService,
} from './exception-telemetry.ts'
export { createTestThemeService, type TestThemeService } from './theme.ts'
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
  createTestNavigationService,
  type TestNavigateCall,
  type TestNavigationService,
  type TestNavigationServiceOptions,
} from './navigation.ts'
