import { initialRouteForDeepLink, type AppServices } from '@reflect/app'
import type { CoreServices, Unlisten } from '@reflect/core'
import { trackSubscriptions } from '@/lib/subscriptions.ts'

/**
 * Boot the graph session until the returned function is called: a note
 * window follows its initial deep link and the main window's navigation
 * requests.
 */
export function bootGraphSession(
  core: Pick<CoreServices, 'graphSession' | 'window'>,
  app: Pick<AppServices, 'deepLinkRouter'>,
): Unlisten {
  const { graphSession: session, window } = core
  const { deepLinkRouter } = app
  const subscriptions = trackSubscriptions()
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
          deepLinkRouter.setInitialWindowRoute(seeded)
        } else if (boot.initialDeepLink !== null) {
          deepLinkRouter.dispatch(boot.initialDeepLink)
        }
        // (Rename follow-through lives in desktop-root: every window needs
        // it, not just this one.)
        // Re-⌘-clicking this window's target focuses it AND re-navigates it
        // there (it may have navigated elsewhere since it opened).
        subscriptions.track(
          window.subscribeNavigate((url) => {
            deepLinkRouter.dispatch(url)
          }),
        )
      },
    }),
  )
  return subscriptions.disposeAll
}
