import type { CoreServices } from '@reflect/core'
import { createTestCoreServices, type TestActivityPort } from '@reflect/core/testing'
import type { OperationsService } from '../app/operations-service.ts'
import { createAppServices, type AppHost, type AppServices } from '../create-app-services.ts'
import { createTestClipboardService, type TestClipboardService } from './clipboard.ts'
import { createTestNativeMenuHost } from './commands.ts'
import { createTestOpenerService, type TestOpenerService } from './opener.ts'
import { createLinkNavigationService } from '../navigation/link-navigation-service.ts'
import { createTestExceptionTelemetry } from './exception-telemetry.ts'
import { createDeepLinkRouter } from '../navigation/deep-link-router.ts'
import { createTestNavigationService, type TestNavigationService } from './navigation.ts'
import { createTestLifecycleService, type TestLifecycleService } from './lifecycle.ts'
import { createTestOperationsService } from './operations.ts'
import { createTestUpdaterAdapter } from './update.ts'

/**
 * {@link AppServices} where each service with a test double is that double.
 */
export type TestAppServices = Omit<
  AppServices,
  'navigation' | 'clipboard' | 'opener' | 'lifecycle'
> & {
  readonly clipboard: TestClipboardService
  readonly opener: TestOpenerService
  readonly navigation: TestNavigationService
  readonly lifecycle: TestLifecycleService
}

/**
 * A host of silent doubles: a test lifecycle, an operations list over a test
 * clock, a recording clipboard and an opener that opens nothing. `overrides`
 * replace fields of the result.
 */
export function createTestAppHost(overrides: Partial<AppHost> = {}): AppHost {
  return {
    lifecycle: createTestLifecycleService(),
    operations: createTestOperationsService(),
    clipboard: createTestClipboardService(),
    opener: { openUrl: async () => {}, revealItemInDir: async () => {} },
    ...overrides,
  }
}

/**
 * The app layer over test core services. Pass the core services a test built
 * (and observes) to share them with the app layer; their `progress` port, when
 * there is one, is the app's operations list. `overrides` replace fields of
 * the result.
 */
export function createTestAppServices(
  core: CoreServices & { readonly progress?: OperationsService } = createTestCoreServices(),
  overrides: Partial<AppServices> = {},
): TestAppServices {
  const operations = overrides.operations ?? core.progress ?? createTestOperationsService()
  const clipboard = overrides.clipboard ?? createTestClipboardService()
  const opener = overrides.opener ?? createTestOpenerService({ logger: core.logger })
  const navigation = overrides.navigation ?? createTestNavigationService()
  // Over the core's test activity port, so one emit reaches both layers.
  const activity = (core as { activity?: TestActivityPort }).activity
  const lifecycle =
    overrides.lifecycle ??
    createTestLifecycleService(activity === undefined ? undefined : { activity })
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
      opener,
      deepLinkRouter,
      navigation,
      attachments: core.attachments,
      operations,
      logger: core.logger,
      graphSession: core.graphSession,
    })
  return {
    ...createAppServices(core, {
      ...createTestAppHost({ operations, clipboard, lifecycle }),
      exceptionTelemetry: createTestExceptionTelemetry(),
      updater: createTestUpdaterAdapter(),
      nativeMenu: createTestNativeMenuHost(),
    }),
    ...overrides,
    clipboard,
    opener,
    lifecycle,
    navigation,
    deepLinkRouter,
    linkNavigation,
  } as TestAppServices
}
