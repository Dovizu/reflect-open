import type { Unlisten } from '../ipc/ipc-service.ts'
import {
  createDeepLinkService,
  type DeepLinkIo,
  type DeepLinkService,
  type DeepLinkSession,
  type DeepLinkServiceDeps,
  type DeepLinkSource,
} from '../navigation/deep-link-service.ts'
import {
  createNavigationService,
  type NavigateOptions,
  type NavigationPosition,
  type NavigationService,
  type NavigationState,
} from '../navigation/navigation-service.ts'
import type { Route } from '../navigation/route.ts'
import { createTestCaptureInboxService } from './capture.ts'
import { createTestClockService } from './clock.ts'
import { createTestGraphSessionService } from './graph-session.ts'
import { createTestIdService } from './id.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'

export interface TestNavigationServiceOptions {
  /**
   * The route the history starts on; defaults to today.
   */
  initialRoute?: Route
}

/**

 * One `navigate` call as the caller made it (before route normalization).

 */
export interface TestNavigateCall {
  route: Route
  options: NavigateOptions | undefined
}

export interface TestNavigationService extends NavigationService {
  /**
   * Every `navigate` call, in order.
   */
  navigations(): readonly TestNavigateCall[]
}

class TestNavigationServiceImpl implements TestNavigationService {
  readonly #inner: NavigationService
  readonly #calls: TestNavigateCall[] = []

  constructor(inner: NavigationService) {
    this.#inner = inner
  }

  readonly getState = (): NavigationState => this.#inner.getState()

  readonly subscribe = (listener: () => void): Unlisten => this.#inner.subscribe(listener)

  readonly navigate = (route: Route, navigateOptions?: NavigateOptions): void => {
    this.#calls.push({ route, options: navigateOptions })
    this.#inner.navigate(route, navigateOptions)
  }

  readonly back = (): void => {
    this.#inner.back()
  }

  readonly forward = (): void => {
    this.#inner.forward()
  }

  readonly navigationRevision = (): number => this.#inner.navigationRevision()

  readonly saveScrollState = (offset: number, at?: NavigationPosition): void => {
    this.#inner.saveScrollState(offset, at)
  }

  readonly clearScrollState = (at?: NavigationPosition): void => {
    this.#inner.clearScrollState(at)
  }

  readonly savedScroll = (at?: NavigationPosition): number | null => this.#inner.savedScroll(at)

  readonly noteMoved = (from: string, to: string): void => {
    this.#inner.noteMoved(from, to)
  }

  readonly reset = (initialRoute?: Route): void => {
    this.#inner.reset(initialRoute)
  }

  navigations(): readonly TestNavigateCall[] {
    return [...this.#calls]
  }
}

/**

 * The real {@link NavigationService}, recording each `navigate` call.

 */
export function createTestNavigationService(
  options?: TestNavigationServiceOptions,
): TestNavigationService {
  return new TestNavigationServiceImpl(
    createNavigationService({ initialRoute: options?.initialRoute }),
  )
}

export interface TestDeepLinkSource extends DeepLinkSource {
  /**
   * Deliver `urls` to every live subscription, as the operating system does.
   */
  deliver(urls: string[]): void
  /**
   * Set the URLs the app was launched with.
   */
  setCurrent(urls: string[] | null): void
  /**
   * How many subscriptions are live.
   */
  subscriptionCount(): number
}

class TestDeepLinkSourceImpl implements TestDeepLinkSource {
  readonly #listeners = new Set<(urls: string[]) => void>()
  #current: string[] | null

  constructor(options?: { current?: string[] | null }) {
    this.#current = options?.current ?? null
  }

  onOpenUrl(listener: (urls: string[]) => void): Promise<Unlisten> {
    this.#listeners.add(listener)
    const unlisten: Unlisten = () => {
      this.#listeners.delete(listener)
    }
    return Promise.resolve(unlisten)
  }

  getCurrent(): Promise<string[] | null> {
    return Promise.resolve(this.#current)
  }

  deliver(urls: string[]): void {
    for (const listener of this.#listeners) {
      listener(urls)
    }
  }

  setCurrent(urls: string[] | null): void {
    this.#current = urls
  }

  subscriptionCount(): number {
    return this.#listeners.size
  }
}

/**

 * An in-memory {@link DeepLinkSource}; `current` holds the launch URLs.

 */
export function createTestDeepLinkSource(options?: {
  current?: string[] | null
}): TestDeepLinkSource {
  return new TestDeepLinkSourceImpl(options)
}

export interface TestDeepLinkServiceOptions extends Partial<DeepLinkServiceDeps> {
  /**
   * Note targets and the paths they resolve to, used without an `indexQuery`.
   * A missing target resolves to `null`.
   */
  notes?: Readonly<Record<string, string>>
}

export interface TestDeepLinkService extends DeepLinkService {
  /**
   * Every URL passed to `dispatch`, in order. Source deliveries are not included.
   */
  dispatched(): readonly string[]
}

class TestDeepLinkServiceImpl implements TestDeepLinkService {
  readonly #inner: DeepLinkService
  readonly #calls: string[] = []

  constructor(inner: DeepLinkService) {
    this.#inner = inner
  }

  readonly startListener = (): Promise<void> => this.#inner.startListener()

  readonly dispatch = (url: string): void => {
    this.#calls.push(url)
    this.#inner.dispatch(url)
  }

  readonly setHandler = (handler: ((url: string) => void) | null): void => {
    this.#inner.setHandler(handler)
  }

  readonly handle = (url: string, io: DeepLinkIo): Promise<void> => this.#inner.handle(url, io)

  readonly serve = (session: DeepLinkSession): Unlisten => this.#inner.serve(session)

  readonly setInitialWindowRoute = (route: Route): void => {
    this.#inner.setInitialWindowRoute(route)
  }

  readonly getInitialWindowRoute = (): Route | null => this.#inner.getInitialWindowRoute()

  dispatched(): readonly string[] {
    return [...this.#calls]
  }
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
  return new TestDeepLinkServiceImpl(
    createDeepLinkService({
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
    }),
  )
}
