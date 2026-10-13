import type { CoreServices } from '@reflect/core'
import { createTestCoreServices, type TestActivityPort } from '@reflect/core/testing'
import { createAppServices, type AppHost, type AppServices } from '../create-app-services.ts'
import { createTestClipboardService, type TestClipboardService } from './clipboard.ts'
import { createTestNativeMenuHost } from './commands.ts'
import { createTestOpenerService, type TestOpenerService } from './opener.ts'
import { createLinkNavigationService } from '../navigation/link-navigation-service.ts'
import { createTestExceptionTelemetry } from './exception-telemetry.ts'
import { createTestLifecycleService, type TestLifecycleService } from './lifecycle.ts'
import {
  createTestDeepLinkService,
  createTestDeepLinkSource,
  createTestNavigationService,
  type TestDeepLinkService,
  type TestNavigationService,
} from './navigation.ts'
import { createTestUpdaterAdapter } from './update.ts'

/**
 * {@link AppServices} where each service with a test double is that double.
 */
export type TestAppServices = Omit<
  AppServices,
  'navigation' | 'deepLink' | 'clipboard' | 'opener' | 'lifecycle'
> & {
  readonly clipboard: TestClipboardService
  readonly opener: TestOpenerService
  readonly navigation: TestNavigationService
  readonly deepLink: TestDeepLinkService
  readonly lifecycle: TestLifecycleService
}

/**
 * A host of silent doubles: a recording clipboard, an opener that opens
 * nothing, and a test lifecycle. `overrides` replace fields of the result.
 */
export function createTestAppHost(overrides: Partial<AppHost> = {}): AppHost {
  return {
    lifecycle: createTestLifecycleService(),
    clipboard: createTestClipboardService(),
    opener: { openUrl: async () => {}, revealItemInDir: async () => {} },
    ...overrides,
  }
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
  const clipboard = overrides.clipboard ?? createTestClipboardService()
  const opener = overrides.opener ?? createTestOpenerService({ logger: core.logger })
  const navigation = overrides.navigation ?? createTestNavigationService()
  // Over the core's test activity port, so one emit reaches both layers.
  const activity = (core as { activity?: TestActivityPort }).activity
  const lifecycle =
    overrides.lifecycle ??
    createTestLifecycleService(activity === undefined ? undefined : { activity })
  const deepLink =
    overrides.deepLink ??
    createTestDeepLinkService({
      source: createTestDeepLinkSource(),
      indexQuery: core.indexQuery,
      captureInbox: core.captureInbox,
      operations: core.operations,
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
      opener,
      deepLink,
      navigation,
      attachments: core.attachments,
      operations: core.operations,
      logger: core.logger,
      graphSession: core.graphSession,
    })
  return {
    ...createAppServices(core, {
      ...createTestAppHost({ clipboard, lifecycle }),
      exceptionTelemetry: createTestExceptionTelemetry(),
      updater: createTestUpdaterAdapter(),
      nativeMenu: createTestNativeMenuHost(),
    }),
    ...overrides,
    clipboard,
    opener,
    navigation,
    deepLink,
    linkNavigation,
  } as TestAppServices
}
