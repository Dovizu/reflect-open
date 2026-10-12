import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import type { GraphInfo } from '@reflect/core'
import { useRouter } from '@/routing/router.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Routes incoming `reflect://` URLs into the open graph session: has the
 * app-lifetime `DeepLinkService` serve this workspace, which replays anything
 * that arrived before a graph was open. No UI — outcomes surface as
 * navigation or a toast inside the service's handler.
 */

interface DeepLinkProviderProps {
  graph: GraphInfo
  children: ReactNode
}

export function DeepLinkProvider({ graph, children }: DeepLinkProviderProps): ReactElement {
  const { navigate, navigationRevision } = useRouter()
  const { deepLink, linkNavigation } = useAppServices()

  // The graph session this provider instance currently serves. Staleness must
  // mean "the session changed", NOT "the effect re-ran": StrictMode's probe
  // cycle detaches and reattaches the handler around an in-flight note
  // resolution, and an effect-scoped flag would silently drop a link the
  // probe attach drained from the intake buffer — exactly a ⌘-clicked note
  // window's initial link. A resolution that outlives this whole instance
  // (graph switch remounts the keyed workspace) navigates a torn-down router,
  // which is a no-op — the wrong-graph homonym can never surface.
  const sessionRef = useRef(graph.generation)

  useEffect(() => {
    sessionRef.current = graph.generation
    const generation = graph.generation
    return deepLink.serve({
      navigate,
      generation,
      beginNavigationIntent: () => {
        const linkIntent = linkNavigation.beginIntent()
        const issuedAtRevision = navigationRevision()
        return () =>
          sessionRef.current !== generation ||
          navigationRevision() !== issuedAtRevision ||
          !linkNavigation.isCurrentIntent(linkIntent)
      },
    })
  }, [deepLink, linkNavigation, navigate, navigationRevision, graph.generation])

  return <>{children}</>
}
