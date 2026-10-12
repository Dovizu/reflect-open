import type { LoggerService } from '../app/logger-service.ts'
import type { OpenerService } from '../app/opener-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { PlatformService } from '../app/platform-service.ts'
import type { WindowService } from '../app/window-service.ts'
import type { AttachmentService } from '../documents/attachment-service.ts'
import { errorMessage } from '../errors.ts'
import type { NoteCreationService } from '../graph/note-creation-service.ts'
import type { NoteLinkResolverService } from '../graph/note-link-resolver-service.ts'
import type { WikiResolverService } from '../indexing/wiki-resolver-service.ts'
import { normalizeWikiTarget } from '../markdown/resolve.ts'
import { deepLinkForRoute } from './deep-link-format.ts'
import { isDeepLinkUrl, parseDeepLink } from './deep-link-parse.ts'
import type { DeepLinkService } from './deep-link-service.ts'
import type { NavigationService } from './navigation-service.ts'
import { routeForPath, type NoteRoute, type Route } from './route.ts'

/**
 * Schemes that must never reach the OS opener: script and data URIs carry
 * executable content rather than an address, and `file:`/`blob:` open
 * arbitrary local content a synced or captured note could point at.
 */
const BLOCKED_SCHEMES: ReadonlySet<string> = new Set([
  'javascript',
  'vbscript',
  'data',
  'blob',
  'about',
  'file',
])

/**
 * Whether `href` is an absolute URL that may be handed to the OS opener.
 * Any app scheme qualifies (`https:`, `x-devonthink-item:`, `bear:`, …) —
 * the OS resolves the handler — but the blocked schemes and scheme-less
 * relative hrefs never do. The opener capability mirrors this policy
 * (`*://*` allowed, `file://*` denied) as the Rust-side backstop.
 */
export function isOpenableExternalUrl(href: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]
  return scheme !== undefined && !BLOCKED_SCHEMES.has(scheme.toLowerCase())
}

/** The route a clicked inline `#tag` opens: the All Notes screen filtered by that tag. */
export function routeForTag(tag: string): Route {
  return { kind: 'allNotes', tag }
}

/** What one link activation needs from the surface that hosts the link. */
export interface LinkNavigationHost {
  /**
   * Navigate in this window. The host passes its router's `navigate`, so the
   * navigation runs the way every other navigation of that surface does.
   */
  navigate: (route: Route) => void
  /**
   * Start one link activation; the returned probe answers "did it go
   * stale?". The host decides what stale means beyond
   * {@link LinkNavigationService.beginIntent} (its own unmount, a scope change).
   */
  beginIntent: () => () => boolean
}

/**
 * Turns an activated link (a `[[wiki link]]`, a Markdown link, a
 * `reflect://` link, a link-like row) into a navigation, a new window, or a
 * user-visible refusal.
 */
export interface LinkNavigationService {
  /**
   * Start a note-link activation. The returned probe is true once a newer
   * activation superseded it or the navigation revision advanced.
   */
  beginIntent: () => () => boolean
  /**
   * Open `route` in a secondary note window. False — never a throw —
   * when this surface can't (no shell, mobile, a route the
   * deep-link grammar doesn't name, or a failed command). Modifier-click
   * callers then navigate in place, so the gesture degrades to a plain click
   * instead of doing nothing.
   */
  openRouteInNewWindow: (route: Route) => Promise<boolean>
  /**
   * Open an in-note `reflect://` link in a secondary window — only links that
   * *address* something (navigate / openNote). Capture links (append, task)
   * are writes, not places: a modifier click still dispatches them normally.
   * Same false-not-throw contract as {@link openRouteInNewWindow}.
   */
  openDeepLinkInNewWindow: (href: string) => Promise<boolean>
  /**
   * Apply the app-wide note-link convention: `openInNewWindow` (decided at
   * the UI boundary from a ⌘/Ctrl click or a spare-`mod` keyboard follow)
   * opens the note in a secondary window; otherwise navigate in place.
   *
   * A native open can be declined (browser/mobile) or fail. In that case the
   * activation falls back to ordinary in-window navigation, unless its
   * intent went stale while the open was in flight.
   */
  openNoteLink: (
    options: { target: NoteRoute; openInNewWindow: boolean },
    host: LinkNavigationHost,
  ) => void
  /**
   * Follow a clicked `[[wiki link]]`. Calendar-valid ISO dates preserve
   * ordinary resolution precedence, then open their lazy daily route on a
   * miss. Every other writable title goes through the ambiguity-preserving
   * index + disk resolver before it opens or creates, so an indexed duplicate
   * cannot bypass the same guard used for an index miss. With a `null`
   * `generation` (no writable graph), existing titles still use the read-only
   * index resolver and unresolved titles are a no-op.
   *
   * Resolution is async, and the host can unmount or the user can act again
   * while it's in flight — a late navigate would yank the user somewhere
   * they've already left, so every navigation is gated on the host's intent.
   */
  followWikiLink: (
    options: { target: string; openInNewWindow: boolean; generation: number | null },
    host: LinkNavigationHost,
  ) => void
  /**
   * Follow a clicked Markdown note link (`[Plan](./Plan.md)`), the
   * counterpart of {@link followWikiLink} for CommonMark hrefs. The href
   * resolves source-relative from `sourcePath` (vault-root for a leading
   * `/`), with the same branch shape as wiki links except that `missing` is a
   * no-op: an unqualified href has two candidate physical locations, so
   * creation would have to guess where the file belongs. A `null`
   * `generation` is a no-op.
   */
  followMarkdownNoteLink: (
    options: {
      href: string
      sourcePath: string
      openInNewWindow: boolean
      generation: number | null
    },
    host: LinkNavigationHost,
  ) => void
  /**
   * The click policy for a rendered Markdown link: an attachment opens
   * through the asset command, a `reflect://` link through the deep-link
   * pipeline, any other allowed scheme through the OS opener, and a
   * scheme-less href is a note link resolved from `sourcePath`. A `null`
   * `sourcePath` means the Markdown belongs to no note, so attachment and
   * note links do nothing.
   */
  followMarkdownLink: (
    options: {
      href: string
      sourcePath: string | null
      openInNewWindow: boolean
      generation: number | null
    },
    host: LinkNavigationHost,
  ) => void
  /**
   * Follow an in-app `reflect://` link, applying the note-link modifier
   * convention to address-like links while leaving capture links as writes
   * in this window. A failed window open falls back only while the host's
   * intent is still current.
   */
  followDeepLink: (
    options: { href: string; openInNewWindow: boolean },
    host: Pick<LinkNavigationHost, 'beginIntent'>,
  ) => void
  /**
   * The one user-visible refusal for an `ambiguous` title resolution
   * (`resolveOrCreateNoteWithTitle`): several notes may claim the title's
   * exact or fallback key, or an unavailable collision prevents proving
   * uniqueness. Neither navigation nor creation may guess in those states.
   */
  reportAmbiguousNoteTitle: (operationLabel: string, title: string) => void
}

export interface LinkNavigationServiceDeps {
  noteLinkResolver: Pick<NoteLinkResolverService, 'resolveWikiTarget' | 'resolveMarkdownHref'>
  noteCreation: Pick<NoteCreationService, 'resolveOrCreateNoteWithTitle'>
  /** The read-only index resolver, for a surface with no writable graph. */
  wikiResolver: Pick<WikiResolverService, 'resolveWikiTarget'>
  window: Pick<WindowService, 'openNoteWindow'>
  platform: Pick<PlatformService, 'isNativeShell' | 'surface'>
  opener: Pick<OpenerService, 'openUrlSync'>
  deepLink: Pick<DeepLinkService, 'dispatch'>
  navigation: Pick<NavigationService, 'navigationRevision'>
  attachments: Pick<AttachmentService, 'resolveAssetOpenPath' | 'openOrReveal'>
  operations: Pick<OperationsService, 'start'>
  logger: Pick<LoggerService, 'error'>
}

export function createLinkNavigationService(
  deps: LinkNavigationServiceDeps,
): LinkNavigationService {
  const {
    noteLinkResolver,
    noteCreation,
    wikiResolver,
    window,
    platform,
    opener,
    deepLink,
    navigation,
    attachments,
    operations,
    logger,
  } = deps

  let latestIntent = 0

  const reportAmbiguousNoteTitle = (operationLabel: string, title: string): void => {
    operations
      .start(operationLabel)
      .fail(
        `Couldn’t safely choose one note matching “${title}”. Rename conflicting notes or wait for unavailable notes to become available, then try again.`,
      )
  }

  const reportUnavailableNote = (name: string): void => {
    operations
      .start('Opening link')
      .fail(
        `Couldn’t open “${name}” because a matching note is currently unavailable. Try again when it is available on this device.`,
      )
  }

  const canOpenWindows = (): boolean => platform.isNativeShell && !platform.surface.mobileApp

  const openRouteInNewWindow = async (route: Route): Promise<boolean> => {
    if (!canOpenWindows()) {
      return false
    }
    const link = deepLinkForRoute(route)
    if (link === null) {
      return false
    }
    return await window.openNoteWindow(link)
  }

  const openDeepLinkInNewWindow = async (href: string): Promise<boolean> => {
    if (!canOpenWindows()) {
      return false
    }
    const link = parseDeepLink(href)
    if (link === null || link.kind === 'capture') {
      return false
    }
    return await window.openNoteWindow(href)
  }

  const openNoteLink: LinkNavigationService['openNoteLink'] = (
    { target, openInNewWindow },
    host,
  ) => {
    const isStale = host.beginIntent()
    if (!openInNewWindow) {
      host.navigate(target)
      return
    }

    void (async () => {
      let opened = false
      try {
        opened = await openRouteInNewWindow(target)
      } catch {
        // Treat a native open failure like a declined open and fall back below.
      }
      if (opened || isStale()) {
        return
      }
      host.navigate(target)
    })()
  }

  const followWikiLink: LinkNavigationService['followWikiLink'] = (
    { target, openInNewWindow, generation },
    host,
  ) => {
    const isStale = host.beginIntent()
    const open = (route: NoteRoute): void => {
      openNoteLink({ target: route, openInNewWindow }, host)
    }
    void (async () => {
      try {
        const normalized = normalizeWikiTarget(target)
        if (normalized.raw === '') {
          return
        }
        if (normalized.date !== undefined) {
          if (generation === null) {
            const resolution = await wikiResolver.resolveWikiTarget(normalized.raw)
            if (isStale()) {
              return
            }
            open(
              resolution.kind === 'resolved'
                ? routeForPath(resolution.ref)
                : { kind: 'daily', date: normalized.date },
            )
            return
          }

          const resolution = await noteLinkResolver.resolveWikiTarget(normalized.raw, generation)
          if (isStale()) {
            return
          }
          if (resolution.kind === 'resolved') {
            open(routeForPath(resolution.path))
          } else if (resolution.kind === 'missing') {
            open({ kind: 'daily', date: normalized.date })
          } else if (resolution.kind === 'ambiguous') {
            reportAmbiguousNoteTitle('Opening link', normalized.raw)
          } else {
            reportUnavailableNote(normalized.raw)
          }
          return
        }
        if (generation !== null) {
          const outcome = await noteCreation.resolveOrCreateNoteWithTitle(
            normalized.raw,
            generation,
          )
          if (isStale()) {
            return
          }
          if (outcome.kind === 'ambiguous') {
            reportAmbiguousNoteTitle('Opening link', normalized.raw)
          } else if (outcome.kind === 'unavailable') {
            reportUnavailableNote(normalized.raw)
          } else {
            open(routeForPath(outcome.path))
          }
          return
        }

        const resolution = await wikiResolver.resolveWikiTarget(normalized.raw)
        if (isStale()) {
          return
        }
        if (resolution.kind === 'resolved') {
          // Deliberately no focus request: on mobile, focusing mid-arrival
          // raises the keyboard through the stack animation. Desktop
          // autofocuses note arrivals on its own.
          open(routeForPath(resolution.ref))
        }
      } catch (err) {
        logger.error('wiki-link resolution failed:', err)
        operations.start('Opening link').fail(errorMessage(err))
      }
    })()
  }

  const followMarkdownNoteLink: LinkNavigationService['followMarkdownNoteLink'] = (
    { href, sourcePath, openInNewWindow, generation },
    host,
  ) => {
    if (generation === null) {
      return
    }
    const isStale = host.beginIntent()
    void (async () => {
      try {
        const resolution = await noteLinkResolver.resolveMarkdownHref(sourcePath, href, generation)
        if (isStale()) {
          return
        }
        if (resolution.kind === 'resolved') {
          openNoteLink({ target: routeForPath(resolution.path), openInNewWindow }, host)
        } else if (resolution.kind === 'ambiguous') {
          reportAmbiguousNoteTitle('Opening link', href)
        } else if (resolution.kind === 'unavailable') {
          reportUnavailableNote(href)
        }
      } catch (err) {
        logger.error('markdown-link resolution failed:', err)
        operations.start('Opening link').fail(errorMessage(err))
      }
    })()
  }

  const followDeepLink: LinkNavigationService['followDeepLink'] = (
    { href, openInNewWindow },
    host,
  ) => {
    const link = parseDeepLink(href)
    // A capture or rejected URL still dispatches so the graph-scoped handler
    // can write it or surface the error, but it cannot supersede navigation.
    if (link === null || link.kind === 'capture') {
      deepLink.dispatch(href)
      return
    }

    const isStale = host.beginIntent()
    if (!openInNewWindow) {
      deepLink.dispatch(href)
      return
    }

    void (async () => {
      let opened = false
      try {
        opened = await openDeepLinkInNewWindow(href)
      } catch {
        // Treat a native open failure like a declined open and fall back below.
      }
      if (opened || isStale()) {
        return
      }
      deepLink.dispatch(href)
    })()
  }

  const followMarkdownLink: LinkNavigationService['followMarkdownLink'] = (
    { href, sourcePath, openInNewWindow, generation },
    host,
  ) => {
    if (generation !== null && sourcePath !== null) {
      const assetPath = attachments.resolveAssetOpenPath(sourcePath, href, generation)
      if (assetPath !== null) {
        void attachments.openOrReveal(assetPath, generation)
        return
      }
    }
    if (isDeepLinkUrl(href)) {
      followDeepLink({ href, openInNewWindow }, host)
      return
    }
    if (isOpenableExternalUrl(href)) {
      opener.openUrlSync(href)
      return
    }
    if (sourcePath !== null) {
      followMarkdownNoteLink({ href, sourcePath, openInNewWindow, generation }, host)
    }
  }

  return {
    beginIntent: () => {
      latestIntent += 1
      const intent = latestIntent
      const startedAtRevision = navigation.navigationRevision()
      return () =>
        latestIntent !== intent || navigation.navigationRevision() !== startedAtRevision
    },
    openRouteInNewWindow,
    openDeepLinkInNewWindow,
    openNoteLink,
    followWikiLink,
    followMarkdownNoteLink,
    followMarkdownLink,
    followDeepLink,
    reportAmbiguousNoteTitle,
  }
}
