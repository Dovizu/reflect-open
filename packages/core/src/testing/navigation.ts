import type { Unlisten } from '../ipc/ipc-service.ts'
import {
  createDeepLinkService,
  type DeepLinkService,
  type DeepLinkServiceDeps,
  type DeepLinkSource,
} from '../navigation/deep-link-service.ts'
import {
  createLinkNavigationService,
  type LinkNavigationService,
  type LinkNavigationServiceDeps,
} from '../navigation/link-navigation-service.ts'
import {
  createNavigationService,
  type NavigateOptions,
  type NavigationService,
} from '../navigation/navigation-service.ts'
import type { Route } from '../navigation/route.ts'
import { createWikiResolverService } from '../indexing/wiki-resolver-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import { createTestAttachmentService } from './attachments.ts'
import { createTestCaptureInboxService } from './capture.ts'
import { createTestClockService } from './clock.ts'
import { createTestDatabaseService } from './database.ts'
import {
  createTestNoteCreationService,
  createTestNoteFileService,
  createTestNoteLinkResolverService,
} from './graph.ts'
import { createTestIdService } from './id.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'
import { createTestPlatformService } from './platform.ts'
import { createTestOpenerService, createTestWindowService } from './shell.ts'

export interface TestNavigationServiceOptions {
  /** The route the history starts on; defaults to today. */
  initialRoute?: Route
}

/** One `navigate` call as the caller made it (before route normalization). */
export interface TestNavigateCall {
  route: Route
  options: NavigateOptions | undefined
}

export interface TestNavigationService extends NavigationService {
  /** Every `navigate` call, in order. */
  navigations(): readonly TestNavigateCall[]
}

/** The real {@link NavigationService}, recording each `navigate` call. */
export function createTestNavigationService(
  options?: TestNavigationServiceOptions,
): TestNavigationService {
  const service = createNavigationService({ initialRoute: options?.initialRoute })
  const calls: TestNavigateCall[] = []
  return {
    ...service,
    navigate: (route, navigateOptions) => {
      calls.push({ route, options: navigateOptions })
      service.navigate(route, navigateOptions)
    },
    navigations: () => [...calls],
  }
}

export interface TestDeepLinkSource extends DeepLinkSource {
  /** Deliver `urls` to every live subscription, as the operating system does. */
  deliver(urls: string[]): void
  /** Set the URLs the app was launched with. */
  setCurrent(urls: string[] | null): void
  /** How many subscriptions are live. */
  subscriptionCount(): number
}

/** An in-memory {@link DeepLinkSource}; `current` holds the launch URLs. */
export function createTestDeepLinkSource(options?: {
  current?: string[] | null
}): TestDeepLinkSource {
  const listeners = new Set<(urls: string[]) => void>()
  let current = options?.current ?? null
  return {
    onOpenUrl: (listener) => {
      listeners.add(listener)
      const unlisten: Unlisten = () => {
        listeners.delete(listener)
      }
      return Promise.resolve(unlisten)
    },
    getCurrent: () => Promise.resolve(current),
    deliver: (urls) => {
      for (const listener of listeners) {
        listener(urls)
      }
    },
    setCurrent: (urls) => {
      current = urls
    },
    subscriptionCount: () => listeners.size,
  }
}

export interface TestDeepLinkServiceOptions extends Partial<DeepLinkServiceDeps> {
  /**
   * Note targets and the paths they resolve to, used without an `indexQuery`.
   * A missing target resolves to `null`.
   */
  notes?: Readonly<Record<string, string>>
}

export interface TestDeepLinkService extends DeepLinkService {
  /** Every URL passed to `dispatch`, in order. Source deliveries are not included. */
  dispatched(): readonly string[]
}

/**
 * The real {@link DeepLinkService} over test doubles (a
 * {@link createTestDeepLinkSource} by default), recording each `dispatch` call.
 */
export function createTestDeepLinkService(
  options?: TestDeepLinkServiceOptions,
): TestDeepLinkService {
  const notes = options?.notes ?? {}
  const service = createDeepLinkService({
    source: options?.source ?? createTestDeepLinkSource(),
    indexQuery: options?.indexQuery ?? {
      resolveNoteTarget: (target) => Promise.resolve(notes[target] ?? null),
    },
    captureInbox: options?.captureInbox ?? createTestCaptureInboxService(),
    operations: options?.operations ?? createTestOperationsService(),
    id: options?.id ?? createTestIdService(),
    clock: options?.clock ?? createTestClockService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
  const calls: string[] = []
  return {
    ...service,
    dispatch: (url) => {
      calls.push(url)
      service.dispatch(url)
    },
    dispatched: () => [...calls],
  }
}

export interface TestLinkNavigationServiceOptions extends Partial<LinkNavigationServiceDeps> {
  /** The files behind the default link resolver and note creation; empty by default. */
  noteFile?: NoteFileService
}

/**
 * The real {@link LinkNavigationService} over test doubles. The default
 * platform is a desktop native shell and the default window opens every note
 * window, so a new-window request succeeds unless a double says otherwise.
 */
export function createTestLinkNavigationService(
  options?: TestLinkNavigationServiceOptions,
): LinkNavigationService {
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  const wikiResolver =
    options?.wikiResolver ?? createWikiResolverService({ database: createTestDatabaseService() })
  const noteLinkResolver =
    options?.noteLinkResolver ?? createTestNoteLinkResolverService({ noteFile })
  return createLinkNavigationService({
    noteLinkResolver,
    noteCreation:
      options?.noteCreation ?? createTestNoteCreationService({ noteFile, noteLinkResolver }),
    wikiResolver,
    window: options?.window ?? createTestWindowService(),
    platform: options?.platform ?? createTestPlatformService(),
    opener: options?.opener ?? createTestOpenerService(),
    deepLink: options?.deepLink ?? createTestDeepLinkService(),
    navigation: options?.navigation ?? createTestNavigationService(),
    attachments: options?.attachments ?? createTestAttachmentService(),
    operations: options?.operations ?? createTestOperationsService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}
