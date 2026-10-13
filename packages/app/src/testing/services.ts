import type { CoreServices } from '@reflect/core'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices, type AppHost, type AppServices } from '../create-app-services.ts'
import { createTestNativeMenuHost } from './commands.ts'

/**
 * The app layer over test core services. Pass the core services a test built
 * (and observes) to share them with the app layer. The host defaults to a test
 * native menu host.
 */
export function createTestAppServices(
  core: CoreServices = createTestCoreServices(),
  host: AppHost = { nativeMenu: createTestNativeMenuHost() },
): AppServices {
  return createAppServices(core, host)
}
