import type { CoreServices } from '@reflect/core'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices, type AppServices } from '../create-app-services.ts'

/**
 * The app layer over test core services. Pass the core services a test built
 * (and observes) to share them with the app layer.
 */
export function createTestAppServices(core: CoreServices = createTestCoreServices()): AppServices {
  return createAppServices(core, {})
}
