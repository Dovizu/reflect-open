import { useState } from 'react'
import {
  createGraphSessionService,
  currentIpc,
  defaultDialog,
  defaultFileChanges,
  defaultIdService,
  defaultIndexStore,
  defaultLifecycle,
  defaultLogger,
  defaultMobileStorage,
  defaultNoteFile,
  defaultPath,
  defaultPlatform,
  defaultWindow,
  subscribeIndexWritten,
  subscribeWindowNavigate,
  type AppPlatform,
  type GraphSessionService,
  type IndexLifecycleService,
  type Unlisten,
} from '@reflect/core'
import { resetNoteRowOverlays } from '@/hooks/note-row-overlay.ts'
import { dispatchDeepLink } from '@/lib/deep-links/intake.ts'
import {
  dropIcloudStatusQuery,
  dropSimilarNotesQueries,
  throttledInvalidateIndexQueries,
} from '@/lib/query-client.ts'
import { trackSubscriptions } from '@/lib/subscriptions.ts'
import {
  initialRouteForDeepLink,
  setInitialWindowRoute,
} from '@/lib/windows/initial-window-route.ts'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/**
 * The {@link GraphSessionService} of the nearest `AppServicesProvider`. Outside
 * one, a session of this component over the process-wide services, which
 * boots as `platform`.
 */
export function useGraphSessionService(
  platform: AppPlatform,
  index: IndexLifecycleService,
): GraphSessionService {
  const app = useOptionalAppServices()
  const [fallback] = useState(() =>
    app !== null
      ? null
      : createGraphSessionService({
          ipc: currentIpc(),
          indexLifecycle: index,
          indexStore: defaultIndexStore(),
          noteFile: defaultNoteFile(),
          id: defaultIdService(),
          fileChanges: defaultFileChanges(),
          window: defaultWindow(),
          dialog: defaultDialog(),
          path: defaultPath(),
          platform: { appPlatform: platform, isMacosDesktop: defaultPlatform().isMacosDesktop },
          lifecycle: defaultLifecycle(),
          mobileStorage: defaultMobileStorage(),
          logger: defaultLogger(),
        }),
  )
  const session = app?.graphSession ?? fallback
  if (session === null) {
    throw new Error('GraphProvider lost its <AppServicesProvider>')
  }
  return session
}

/**
 * Boot `session` and connect the app to it until the returned function is
 * called: what the app holds per graph is dropped as graphs change, and a
 * note window follows its initial deep link and the main window's index.
 */
export function bootGraphSession(session: GraphSessionService): Unlisten {
  const subscriptions = trackSubscriptions()
  subscriptions.track(
    session.onGraphReleased((reason) => {
      // Reclaim the prior graph's optimistic note-row overlays and, on a
      // switch, its session-held "Similar notes" results.
      resetNoteRowOverlays()
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
          setInitialWindowRoute(seeded)
        } else if (boot.initialDeepLink !== null) {
          dispatchDeepLink(boot.initialDeepLink)
        }
        // The Rust `index:written` broadcast (fired after the main window's
        // applies commit) keeps this window's index-backed queries fresh.
        subscriptions.track(subscribeIndexWritten(throttledInvalidateIndexQueries))
        // (Rename follow-through lives in desktop-root: every window needs
        // it, not just this one.)
        // Re-⌘-clicking this window's target focuses it AND re-navigates it
        // there (it may have navigated elsewhere since it opened).
        subscriptions.track(subscribeWindowNavigate(dispatchDeepLink))
      },
    }),
  )
  return subscriptions.disposeAll
}
