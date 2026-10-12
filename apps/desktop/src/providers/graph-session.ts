import { initialRouteForDeepLink, type AppServices, type Unlisten } from '@reflect/core'
import {
  dropIcloudStatusQuery,
  dropSimilarNotesQueries,
  throttledInvalidateIndexQueries,
} from '@/lib/query-client.ts'
import { trackSubscriptions } from '@/lib/subscriptions.ts'

/**
 * Boot the graph session and connect the app to it until the returned
 * function is called: what the app holds per graph is dropped as graphs
 * change, and a note window follows its initial deep link and the main
 * window's index.
 */
export function bootGraphSession(
  ctx: Pick<AppServices, 'graphSession' | 'deepLink' | 'window' | 'noteRows'>,
): Unlisten {
  const { graphSession: session, deepLink, window, noteRows } = ctx
  const subscriptions = trackSubscriptions()
  subscriptions.track(
    session.onGraphReleased((reason) => {
      // Reclaim the prior graph's optimistic note-row overlays and, on a
      // switch, its session-held "Similar notes" results.
      noteRows.reset()
      if (reason === 'switch') {
        dropSimilarNotesQueries()
      }
    }),
  )
  // The delete trashed a directory the chooser may list: drop the cached
  // iCloud listing so the chooser refetches it rather than showing the
  // deleted graph (queries never go stale on their own, see query-client).
  subscriptions.track(session.onGraphDeleted(dropIcloudStatusQuery))
  subscriptions.track(
    session.boot({
      // The initial deep link seeds the router directly whenever it resolves
      // synchronously (⌘-click builds path-shaped links), so the window's
      // first workspace render is already the clicked note: no flash of
      // today's daily note. Only a target that needs the index (an
      // id/title-shaped link) rides the ordinary intake, buffering until
      // DeepLinkProvider attaches.
      onWindowBootstrap: (boot) => {
        const seeded = initialRouteForDeepLink(boot.initialDeepLink)
        if (seeded !== null) {
          deepLink.setInitialWindowRoute(seeded)
        } else if (boot.initialDeepLink !== null) {
          deepLink.dispatch(boot.initialDeepLink)
        }
        // The Rust `index:written` broadcast (fired after the main window's
        // applies commit) keeps this window's index-backed queries fresh.
        subscriptions.track(window.subscribeIndexWritten(throttledInvalidateIndexQueries))
        // (Rename follow-through lives in desktop-root: every window needs
        // it, not just this one.)
        // Re-⌘-clicking this window's target focuses it AND re-navigates it
        // there (it may have navigated elsewhere since it opened).
        subscriptions.track(
          window.subscribeNavigate((url) => {
            deepLink.dispatch(url)
          }),
        )
      },
    }),
  )
  return subscriptions.disposeAll
}
