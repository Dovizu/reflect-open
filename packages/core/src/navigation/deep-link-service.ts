import { textCaptureEnvelopeSchema } from '../capture/capture-envelope.ts'
import type { ClockService } from '../app/clock-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { GraphSession } from '../app/graph-session.ts'
import { errorMessage } from '../errors.ts'
import type { CaptureInboxService } from '../graph/capture-inbox-service.ts'
import type { GraphSessionService } from '../graph/graph-session-service.ts'
import type { IndexQueryService } from '../indexing/index-query-service.ts'
import type { Unlisten } from '../unlisten.ts'
import { parseDeepLink } from './deep-link-parse.ts'
import { routeForPath, type Route } from './route.ts'

/**

 * The operating system's delivery of `reflect://` URLs to the app.

 */
export interface DeepLinkSource {
  /**
   * Hear the URLs that arrive while the app runs.
   */
  onOpenUrl(listener: (urls: string[]) => void): Promise<Unlisten>
  /**
   * The URLs the app was launched with, or `null`.
   */
  getCurrent(): Promise<string[] | null>
}

/**

 * A {@link DeepLinkSource} for hosts where the system delivers no URLs.

 */
export function createNoDeepLinkSource(): DeepLinkSource {
  return {
    onOpenUrl: () => Promise.resolve(() => {}),
    getCurrent: () => Promise.resolve(null),
  }
}

/**

 * What acting on a deep link needs from the open graph session.

 */
export interface DeepLinkIo {
  navigate: (route: Route) => void
  /**
   * Whether the graph session or navigation intent changed while the handler
   * awaited. Note resolution queries whichever index is open when it runs, so
   * a stale result must be dropped, never navigated — it may name a homonym
   * note in the newly opened graph or override a newer user action. (The
   * capture path needs no gate: the spool write is generation-pinned in Rust
   * and fails loudly when stale.)
   */
  isStale?: () => boolean
}

/**

 * The open graph session that acts on incoming deep links.

 */
export interface DeepLinkSession {
  navigate: (route: Route) => void
  /**
   * Start one navigation intent for a link that addresses a place. The
   * returned probe answers whether the intent went stale since.
   */
  beginNavigationIntent: () => () => boolean
}

/**
 * The app-lifetime deep-link intake and the handler behind it. The OS
 * delivers `reflect://` URLs to the app as a whole, but they can only be
 * *acted on* inside an open graph (the router and the capture inbox are
 * graph-scoped), so the service decouples the two lifetimes:
 * {@link DeepLinkService.startListener} subscribes exactly once per app run,
 * and URLs buffer until a workspace's handler is attached — a link that
 * launched the app, or arrived on the graph chooser, fires the moment the
 * graph opens instead of being dropped.
 */
export interface DeepLinkService {
  /**
   * Subscribe to the {@link DeepLinkSource} once for the app's lifetime: the
   * URL stream (`onOpenUrl`) for URLs that arrive while running, then
   * `getCurrent` for the URL the app was launched with — `onOpenUrl` alone
   * does not replay it. Subscribing before the `getCurrent` read means a URL
   * landing in the startup gap is doubled rather than dropped; doubling is
   * benign (navigation is idempotent, and the capture drain's exact-line
   * dedupe absorbs a repeated append). Idempotent: the subscription is never
   * torn down, so a re-render or StrictMode double-mount can't re-deliver the
   * launch URL.
   */
  startListener(): Promise<void>
  /**
   * Feed one `reflect://` URL into the intake as if the OS had delivered it —
   * the entry point for deep links clicked *inside* the app (a link in a note
   * body must not round-trip through the OS opener: the opener capability
   * denies the scheme, dev builds don't register it, and macOS could hand the
   * URL to a different installed flavor). Buffers like any OS delivery when no
   * graph is open.
   */
  dispatch(url: string): void
  /**
   * Attach the workspace's handler (or detach with null on unmount). Attaching
   * drains any URLs that arrived while no graph was open, in arrival order.
   */
  setHandler(handler: ((url: string) => void) | null): void
  /**
   * Act on one incoming `reflect://` URL: navigation links navigate (a note
   * target resolving through the index first), capture links spool an envelope
   * into `.reflect/inbox/` for the watcher-triggered drain to materialize.
   * Every outcome that isn't a navigation surfaces on the operations status
   * line — an outside-world input must never crash or silently vanish. A
   * capture spools into the graph open when the call starts.
   */
  handle(url: string, io: DeepLinkIo): Promise<void>
  /**
   * Route incoming URLs into `session` until the returned function is called:
   * attaches a handler that runs {@link DeepLinkService.handle} for each URL
   * and logs a rejection. Only a link that addresses a place begins a
   * navigation intent. The graph open when `serve` is called is the one every
   * URL acts on; a note resolution that outlives it is dropped.
   */
  serve(session: DeepLinkSession): Unlisten
  /**
   * Record a note window's first route, derived from its initial deep link
   * BEFORE the router mounts — so the window's first workspace render is
   * already the ⌘-clicked note instead of flashing today's daily note while
   * the link rides the async intake.
   */
  setInitialWindowRoute(route: Route): void
  /**
   * The derived first route, or null (main window, reload, unresolvable
   * link). Plain slot, not consume-once: a webview boots once, and idempotent
   * reads survive StrictMode's double-invoked initializers.
   */
  getInitialWindowRoute(): Route | null
}

export interface DeepLinkServiceDeps {
  readonly source: DeepLinkSource
  readonly indexQuery: Pick<IndexQueryService, 'resolveNoteTarget'>
  readonly captureInbox: Pick<CaptureInboxService, 'spool'>
  readonly operations: Pick<OperationsService, 'start'>
  readonly id: Pick<IdService, 'uuid'>
  readonly clock: Pick<ClockService, 'now'>
  readonly logger: Pick<LoggerService, 'error'>
  readonly graphSession: Pick<GraphSessionService, 'getState'>
}

class DeepLinkServiceImpl implements DeepLinkService {
  readonly #deps: DeepLinkServiceDeps
  #pendingUrls: string[] = []
  #activeHandler: ((url: string) => void) | null = null
  #started = false
  #initialRoute: Route | null = null

  constructor(deps: DeepLinkServiceDeps) {
    this.#deps = deps
  }

  async startListener(): Promise<void> {
    if (this.#started) {
      return
    }
    this.#started = true
    let unlisten: Unlisten | null = null
    try {
      unlisten = await this.#deps.source.onOpenUrl((urls) => {
        for (const url of urls) {
          this.dispatch(url)
        }
      })
      for (const url of (await this.#deps.source.getCurrent()) ?? []) {
        this.dispatch(url)
      }
    } catch (cause) {
      // Unlatch FIRST so a later call can retry — a failed start must not
      // disable deep links for the rest of the app run. If the subscription
      // itself succeeded (`getCurrent` failed), tear it down too, or the retry
      // would stack a second subscription and double-deliver every URL; the
      // teardown is best-effort, so a throwing unlisten can neither re-latch
      // nor mask the original failure.
      this.#started = false
      try {
        unlisten?.()
      } catch {
        // the original `cause` is the story
      }
      throw cause
    }
  }

  dispatch(url: string): void {
    if (this.#activeHandler !== null) {
      this.#activeHandler(url)
    } else {
      this.#pendingUrls.push(url)
    }
  }

  setHandler(handler: ((url: string) => void) | null): void {
    this.#activeHandler = handler
    if (handler !== null && this.#pendingUrls.length > 0) {
      const queued = this.#pendingUrls
      this.#pendingUrls = []
      for (const url of queued) {
        handler(url)
      }
    }
  }

  handle(url: string, io: DeepLinkIo): Promise<void> {
    return this.#handleIn(url, io, this.#deps.graphSession.getState().session)
  }

  serve(session: DeepLinkSession): Unlisten {
    const { logger, graphSession } = this.#deps
    const { navigate } = session
    const graph = graphSession.getState().session
    this.setHandler((url) => {
      const link = parseDeepLink(url)
      // Capture and rejected URLs do not express a navigation intent, so they
      // must not supersede a note target that is still resolving.
      let io: DeepLinkIo = { navigate }
      if (link !== null && link.kind !== 'capture') {
        const intentStale = session.beginNavigationIntent()
        io = { navigate, isStale: () => graph?.signal.aborted === true || intentStale() }
      }
      this.#handleIn(url, io, graph).catch((cause: unknown) => {
        logger.error(`deep link failed: ${url}`, cause)
      })
    })
    return () => {
      this.setHandler(null)
    }
  }

  setInitialWindowRoute(route: Route): void {
    this.#initialRoute = route
  }

  getInitialWindowRoute(): Route | null {
    return this.#initialRoute
  }

  async #handleIn(url: string, io: DeepLinkIo, session: GraphSession | null): Promise<void> {
    const { indexQuery, captureInbox, operations, id, clock } = this.#deps
    const link = parseDeepLink(url)
    if (link === null) {
      operations.start('Opening link').fail(`Unrecognized link: ${truncate(url)}`)
      return
    }
    switch (link.kind) {
      case 'navigate':
        io.navigate(link.route)
        return
      case 'openNote': {
        let path: string | null
        try {
          path = await indexQuery.resolveNoteTarget(link.target)
        } catch (cause) {
          if (io.isStale?.() === true) {
            return
          }
          operations.start('Opening link').fail(errorMessage(cause))
          return
        }
        if (io.isStale?.() === true) {
          return // the graph switched mid-resolve; the result answers the wrong graph
        }
        if (path === null) {
          operations.start('Opening link').fail(`Note not found: ${truncate(link.target)}`)
          return
        }
        io.navigate(routeForPath(path))
        return
      }
      case 'capture': {
        const label =
          link.capture === 'task'
            ? 'Task added to today'
            : link.capture === 'checkbox'
              ? 'Checkbox added to today'
              : 'Added to today'
        if (session === null) {
          operations.start('Saving capture').fail('No graph is open.')
          return
        }
        try {
          // The URL parser enforces the same text constraints, so this parse is
          // belt-and-braces — but it is fallible, and a schema tightening must
          // surface like every other failure here, not escape the handler.
          const envelope = textCaptureEnvelopeSchema.parse({
            version: 1,
            id: id.uuid(),
            kind: link.capture,
            text: link.text,
            capturedAt: new Date(clock.now()).toISOString(),
            source: 'deep-link',
          })
          await captureInbox.spool(
            `${envelope.id}.json`,
            JSON.stringify(envelope),
            session.generation,
          )
        } catch (cause) {
          operations.start('Saving capture').fail(errorMessage(cause))
          return
        }
        operations.start(label).done()
      }
    }
  }
}

export function createDeepLinkService(deps: DeepLinkServiceDeps): DeepLinkService {
  return new DeepLinkServiceImpl(deps)
}

/**

 * Status-line-sized excerpt of an untrusted URL or target.

 */
function truncate(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}…` : value
}
