import type { CoreServices } from '@reflect/core'
import { createTestCoreServices } from '@reflect/core/testing'
import type { AppServices } from '../create-app-services.ts'
import { createLinkNavigationService } from '../navigation/link-navigation-service.ts'
import {
  createTestDeepLinkService,
  createTestDeepLinkSource,
  createTestNavigationService,
  type TestDeepLinkService,
  type TestNavigationService,
} from './navigation.ts'

/**
 * {@link AppServices} where each service with a test double is that double.
 */
export type TestAppServices = Omit<AppServices, 'navigation' | 'deepLink'> & {
  readonly navigation: TestNavigationService
  readonly deepLink: TestDeepLinkService
}

/**
 * The app layer over test core services. Pass the core services a test built
 * (and observes) to share them with the app layer, and `overrides` in place of
 * the matching app services.
 */
export function createTestAppServices<
  Overrides extends Partial<AppServices> = Record<never, never>,
>(
  core: CoreServices = createTestCoreServices(),
  overrides?: Overrides,
): Omit<TestAppServices, keyof Overrides> & Overrides {
  const navigation = overrides?.navigation ?? createTestNavigationService()
  const deepLink =
    overrides?.deepLink ??
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
    overrides?.linkNavigation ??
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
      operations: core.operations,
      logger: core.logger,
      graphSession: core.graphSession,
    })
  return { navigation, deepLink, linkNavigation } as Omit<TestAppServices, keyof Overrides> &
    Overrides
}
