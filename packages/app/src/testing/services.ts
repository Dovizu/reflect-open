import type { CoreServices } from '@reflect/core'
import { createTestCoreServices } from '@reflect/core/testing'
import type { OperationsService } from '../app/operations-service.ts'
import { createAppServices, type AppServices } from '../create-app-services.ts'
import { createTestNativeMenuHost } from './commands.ts'
import { createLinkNavigationService } from '../navigation/link-navigation-service.ts'
import { createTestExceptionTelemetry } from './exception-telemetry.ts'
import {
  createTestDeepLinkService,
  createTestDeepLinkSource,
  createTestNavigationService,
  type TestDeepLinkService,
  type TestNavigationService,
} from './navigation.ts'
import { createTestOperationsService } from './operations.ts'
import { createTestUpdaterAdapter } from './update.ts'

/**
 * {@link AppServices} where each service with a test double is that double.
 */
export type TestAppServices = Omit<AppServices, 'navigation' | 'deepLink'> & {
  readonly navigation: TestNavigationService
  readonly deepLink: TestDeepLinkService
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
  const navigation = overrides.navigation ?? createTestNavigationService()
  const deepLink =
    overrides.deepLink ??
    createTestDeepLinkService({
      source: createTestDeepLinkSource(),
      indexQuery: core.indexQuery,
      captureInbox: core.captureInbox,
      operations,
      id: core.id,
      clock: core.clock,
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
      deepLink,
      navigation,
      attachments: core.attachments,
      operations,
      logger: core.logger,
      graphSession: core.graphSession,
    })
  return {
    ...createAppServices(core, {
      operations,
      exceptionTelemetry: createTestExceptionTelemetry(),
      updater: createTestUpdaterAdapter(),
      nativeMenu: createTestNativeMenuHost(),
    }),
    ...overrides,
    navigation,
    deepLink,
    linkNavigation,
  } as TestAppServices
}
