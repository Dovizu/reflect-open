import type { CoreServices } from '@reflect/core'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices, type AppServices } from '../create-app-services.ts'
import { createTestExceptionTelemetry } from './exception-telemetry.ts'
import { createTestUpdaterAdapter } from './update.ts'

/**
 * The app layer over test core services. Pass the core services a test built
 * (and observes) to share them with the app layer. `overrides` replace
 * fields of the result.
 */
export function createTestAppServices(
  core: CoreServices = createTestCoreServices(),
  overrides: Partial<AppServices> = {},
): AppServices {
  return {
    ...createAppServices(core, {
      exceptionTelemetry: createTestExceptionTelemetry(),
      updater: createTestUpdaterAdapter(),
    }),
    ...overrides,
  }
}
