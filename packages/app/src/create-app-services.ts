import type { CoreServices } from '@reflect/core'
import {
  createDeepLinkService,
  createNoDeepLinkSource,
  type DeepLinkService,
  type DeepLinkSource,
} from './navigation/deep-link-service.ts'
import {
  createLinkNavigationService,
  type LinkNavigationService,
} from './navigation/link-navigation-service.ts'
import { createNavigationService, type NavigationService } from './navigation/navigation-service.ts'

/**
 * What the host supplies to the app layer: the window, lifecycle, storage,
 * updater, menu and deep-link primitives of one webview.
 */
export interface AppHost {
  /**
   * The system's `reflect://` delivery; without one, no URL arrives.
   */
  readonly deepLink?: DeepLinkSource
}

/**
 * The app-layer services of one webview, built over the core services.
 */
export interface AppServices {
  /**
   * The webview's navigation history; a note window has its own webview, hence its own.
   */
  readonly navigation: NavigationService
  /**
   * The `reflect://` intake of this webview and the handler behind it.
   */
  readonly deepLink: DeepLinkService
  /**
   * Turns an activated link into a navigation, a new window, or a refusal.
   */
  readonly linkNavigation: LinkNavigationService
}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  const navigation = createNavigationService()
  const deepLink = createDeepLinkService({
    // The OS delivers deep links to every webview; only the main window takes them.
    source: (core.window.isMainWindow() ? host.deepLink : undefined) ?? createNoDeepLinkSource(),
    indexQuery: core.indexQuery,
    captureInbox: core.captureInbox,
    operations: core.operations,
    id: core.id,
    clock: core.clock,
    logger: core.logger,
    graphSession: core.graphSession,
  })
  const linkNavigation = createLinkNavigationService({
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
  return { navigation, deepLink, linkNavigation }
}
