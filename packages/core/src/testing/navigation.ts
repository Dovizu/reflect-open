import type { Unlisten } from '../ipc/ipc-service.ts'
import {
  createDeepLinkService,
  type DeepLinkService,
  type DeepLinkServiceDeps,
  type DeepLinkSource,
} from '../navigation/deep-link-service.ts'
import {
  createNavigationService,
  type NavigateOptions,
  type NavigationService,
} from '../navigation/navigation-service.ts'
import type { Route } from '../navigation/route.ts'
import { createTestCaptureInboxService } from './capture.ts'
import { createTestClockService } from './clock.ts'
import { createTestGraphSessionService } from './graph-session.ts'
import { createTestIdService } from './id.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'

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
 * {@link createTestDeepLinkSource} by default, and the test graph open with
 * generation 1), recording each `dispatch` call.
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
    graphSession: options?.graphSession ?? createTestGraphSessionService({ graph: {} }),
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
