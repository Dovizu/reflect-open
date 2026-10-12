import { textCaptureEnvelopeSchema } from '../capture/capture-envelope.ts'
import type { ClockService } from '../app/clock-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import { errorMessage } from '../errors.ts'
import type { CaptureInboxService } from '../graph/capture-inbox-service.ts'
import type { IndexQueryService } from '../indexing/index-query-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import { parseDeepLink } from './deep-link-parse.ts'
import { routeForPath, type Route } from './route.ts'

/** The operating system's delivery of `reflect://` URLs to the app. */
export interface DeepLinkSource {
  /** Hear the URLs that arrive while the app runs. */
  onOpenUrl(listener: (urls: string[]) => void): Promise<Unlisten>
  /** The URLs the app was launched with, or `null`. */
  getCurrent(): Promise<string[] | null>
}

/** A {@link DeepLinkSource} for hosts where the system delivers no URLs. */
export function createNoDeepLinkSource(): DeepLinkSource {
  return {
    onOpenUrl: () => Promise.resolve(() => {}),
    getCurrent: () => Promise.resolve(null),
  }
}

/** What acting on a deep link needs from the open graph session. */
export interface DeepLinkIo {
  navigate: (route: Route) => void
  /** `GraphInfo.generation` — pins the capture spool to the issuing graph. */
  generation: number
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

/** The open graph session that acts on incoming deep links. */
export interface DeepLinkSession {
  navigate: (route: Route) => void
  /** `GraphInfo.generation` of the session. */
  generation: number
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
  startListener: () => Promise<void>
  /**
   * Feed one `reflect://` URL into the intake as if the OS had delivered it —
   * the entry point for deep links clicked *inside* the app (a link in a note
   * body must not round-trip through the OS opener: the opener capability
   * denies the scheme, dev builds don't register it, and macOS could hand the
   * URL to a different installed flavor). Buffers like any OS delivery when no
   * graph is open.
   */
  dispatch: (url: string) => void
  /**
   * Attach the workspace's handler (or detach with null on unmount). Attaching
   * drains any URLs that arrived while no graph was open, in arrival order.
   */
  setHandler: (handler: ((url: string) => void) | null) => void
  /**
   * Act on one incoming `reflect://` URL: navigation links navigate (a note
   * target resolving through the index first), capture links spool an envelope
   * into `.reflect/inbox/` for the watcher-triggered drain to materialize.
   * Every outcome that isn't a navigation surfaces on the operations status
   * line — an outside-world input must never crash or silently vanish.
   */
  handle: (url: string, io: DeepLinkIo) => Promise<void>
  /**
   * Route incoming URLs into `session` until the returned function is called:
   * attaches a handler that runs {@link DeepLinkService.handle} for each URL
   * and logs a rejection. Only a link that addresses a place begins a
   * navigation intent.
   */
  serve: (session: DeepLinkSession) => Unlisten
  /**
   * Record a note window's first route, derived from its initial deep link
   * BEFORE the router mounts — so the window's first workspace render is
   * already the ⌘-clicked note instead of flashing today's daily note while
   * the link rides the async intake.
   */
  setInitialWindowRoute: (route: Route) => void
  /**
   * The derived first route, or null (main window, reload, unresolvable
   * link). Plain slot, not consume-once: a webview boots once, and idempotent
   * reads survive StrictMode's double-invoked initializers.
   */
  getInitialWindowRoute: () => Route | null
}

export interface DeepLinkServiceDeps {
  source: DeepLinkSource
  indexQuery: Pick<IndexQueryService, 'resolveNoteTarget'>
  captureInbox: Pick<CaptureInboxService, 'spool'>
  operations: Pick<OperationsService, 'start'>
  id: Pick<IdService, 'uuid'>
  clock: Pick<ClockService, 'now'>
  logger: Pick<LoggerService, 'error'>
}

export function createDeepLinkService(deps: DeepLinkServiceDeps): DeepLinkService {
  const { source, indexQuery, captureInbox, operations, id, clock, logger } = deps

  let pendingUrls: string[] = []
  let activeHandler: ((url: string) => void) | null = null
  let started = false
  let initialRoute: Route | null = null

  const dispatch = (url: string): void => {
    if (activeHandler !== null) {
      activeHandler(url)
    } else {
      pendingUrls.push(url)
    }
  }

  const setHandler = (handler: ((url: string) => void) | null): void => {
    activeHandler = handler
    if (handler !== null && pendingUrls.length > 0) {
      const queued = pendingUrls
      pendingUrls = []
      for (const url of queued) {
        handler(url)
      }
    }
  }

  const startListener = async (): Promise<void> => {
    if (started) {
      return
    }
    started = true
    let unlisten: Unlisten | null = null
    try {
      unlisten = await source.onOpenUrl((urls) => {
        for (const url of urls) {
          dispatch(url)
        }
      })
      for (const url of (await source.getCurrent()) ?? []) {
        dispatch(url)
      }
    } catch (cause) {
      // Unlatch FIRST so a later call can retry — a failed start must not
      // disable deep links for the rest of the app run. If the subscription
      // itself succeeded (`getCurrent` failed), tear it down too, or the retry
      // would stack a second subscription and double-deliver every URL; the
      // teardown is best-effort, so a throwing unlisten can neither re-latch
      // nor mask the original failure.
      started = false
      try {
        unlisten?.()
      } catch {
        // the original `cause` is the story
      }
      throw cause
    }
  }

  const handle = async (url: string, io: DeepLinkIo): Promise<void> => {
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
          await captureInbox.spool(`${envelope.id}.json`, JSON.stringify(envelope), io.generation)
        } catch (cause) {
          operations.start('Saving capture').fail(errorMessage(cause))
          return
        }
        operations.start(label).done()
      }
    }
  }

  const serve = (session: DeepLinkSession): Unlisten => {
    const { navigate, generation } = session
    setHandler((url) => {
      const link = parseDeepLink(url)
      // Capture and rejected URLs do not express a navigation intent, so they
      // must not supersede a note target that is still resolving.
      const io: DeepLinkIo =
        link !== null && link.kind !== 'capture'
          ? { navigate, generation, isStale: session.beginNavigationIntent() }
          : { navigate, generation }
      handle(url, io).catch((cause: unknown) => {
        logger.error(`deep link failed: ${url}`, cause)
      })
    })
    return () => {
      setHandler(null)
    }
  }

  return {
    startListener,
    dispatch,
    setHandler,
    handle,
    serve,
    setInitialWindowRoute: (route) => {
      initialRoute = route
    },
    getInitialWindowRoute: () => initialRoute,
  }
}

/** Status-line-sized excerpt of an untrusted URL or target. */
function truncate(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}…` : value
}
