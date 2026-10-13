import type { CoreServices } from '@reflect/core'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices, type AppServices } from '../create-app-services.ts'
import { createTestNativeMenuHost } from './commands.ts'
import { createLinkNavigationService } from '../navigation/link-navigation-service.ts'
import { createTestExceptionTelemetry } from './exception-telemetry.ts'
import { createDeepLinkRouter } from '../navigation/deep-link-router.ts'
import { createTestNavigationService, type TestNavigationService } from './navigation.ts'
import { createTestUpdaterAdapter } from './update.ts'

/**
 * {@link AppServices} where each service with a test double is that double.
 */
export type TestAppServices = Omit<AppServices, 'navigation'> & {
  readonly navigation: TestNavigationService
}

/**
 * The app layer over test core services. Pass the core services a test built
 * (and observes) to share them with the app layer. `overrides` replace
 * fields of the result.
 */
export function createTestAppServices(
  core: CoreServices = createTestCoreServices(),
  overrides: Partial<AppServices> = {},
): TestAppServices {
  const navigation = overrides.navigation ?? createTestNavigationService()
  const deepLinkRouter =
    overrides.deepLinkRouter ??
    createDeepLinkRouter({
      intake: core.deepLinkIntake,
      logger: core.logger,
      graphSession: core.graphSession,
    })
  const linkNavigation =
    overrides.linkNavigation ??
    createLinkNavigationService({
      noteLinkResolver: core.noteLinkResolver,
      noteCreation: core.noteCreation,
      wikiResolver: core.wikiResolver,
      window: core.window,
      platform: core.platform,
      opener: core.opener,
      deepLinkRouter,
      navigation,
      attachments: core.attachments,
      operations: core.operations,
      logger: core.logger,
      graphSession: core.graphSession,
    })
  return {
    ...createAppServices(core, {
      exceptionTelemetry: createTestExceptionTelemetry(),
      updater: createTestUpdaterAdapter(),
      nativeMenu: createTestNativeMenuHost(),
    }),
    ...overrides,
    navigation,
    deepLinkRouter,
    linkNavigation,
  } as TestAppServices
}
