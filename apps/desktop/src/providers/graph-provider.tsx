import { createContext, use, useEffect, useMemo, type ReactNode } from 'react'
import type {
  AppPlatform,
  GraphServices,
  GraphSessionService,
  GraphSessionState,
} from '@reflect/core'
import { GraphServicesProvider, useAppServices } from '@/services/services-provider.tsx'
import { useServiceState } from '@/services/use-service-state.ts'
import { bootGraphSession } from './graph-session.ts'
import { useMobileGraphBoot, type MobileGraphBoot } from './use-mobile-graph-boot.ts'

export type { GraphStatus } from '@reflect/core'

/**
 * The graph context surface: the session state and its actions, the
 * mobile-only slice documented on {@link MobileGraphBoot}, and the platform.
 */
type GraphContextValue = GraphSessionState<GraphServices> &
  Pick<
    GraphSessionService,
    'pickAndOpen' | 'chooseGraph' | 'openRecent' | 'deleteGraph' | 'refreshIndex'
  > &
  MobileGraphBoot & {
    /**
     * `GraphSessionService.createGraphAt`.
     */
    createAt: GraphSessionService['createGraphAt']
    /**
     * `GraphSessionService.forgetRecent`.
     */
    forget: GraphSessionService['forgetRecent']
    /**
     * Which UI family the shell was built for (Plan 19's root gate), fixed at
     * boot; gates platform-only surfaces like the iOS subscription paywall.
     */
    platform: AppPlatform
  }

const GraphContext = createContext<GraphContextValue | null>(null)

/**
 * Owns the active graph and the open/choose flow. On mount it auto-opens the
 * most-recent graph (so the app reopens where you left off) and otherwise shows
 * the chooser. All durable file access goes through `@reflect/core` commands.
 *
 * On mobile (Plans 19/21) there is no chooser and no recents-driven reopen:
 * the graph lives in one of two fixed roots — the app's iCloud Drive
 * container (the recommended default; syncs across devices) or the app
 * sandbox `Documents/` — and only the *kind* is persisted. Absolute paths are
 * **derived fresh every launch** because iOS container paths change across
 * restore/update, so a persisted recent would point at a dead path.
 * `platform` selects the bootstrap; everything downstream of the open is
 * shared.
 */
export function GraphProvider({
  children,
  platform = 'desktop',
}: {
  children: ReactNode
  platform?: AppPlatform
}) {
  const app = useAppServices()
  const session = app.graphSession
  const state = useServiceState(session, session.getState)

  // Desktop main-window boot reopens the most recent graph or shows the
  // chooser; a secondary note window adopts the main window's graph. Mobile
  // boots through its hook below.
  useEffect(() => bootGraphSession(app), [app])

  // The mobile bootstrap + onboarding slice (Plans 19/21) lives in its own
  // service; it opens and parks through the session.
  const mobile = useMobileGraphBoot()

  const value = useMemo<GraphContextValue>(
    () => ({
      ...session,
      ...state,
      ...mobile,
      createAt: session.createGraphAt,
      forget: session.forgetRecent,
      platform,
    }),
    [session, state, mobile, platform],
  )

  return (
    <GraphContext value={value}>
      <GraphServicesProvider services={state.services}>{children}</GraphServicesProvider>
    </GraphContext>
  )
}

/**
 * Access the active graph + open/choose actions. Use within a GraphProvider.
 */
export function useGraph(): GraphContextValue {
  const context = useMaybeGraph()
  if (!context) {
    throw new Error('useGraph must be used within a GraphProvider')
  }
  return context
}

/**
 * The active graph + open/choose actions, or `null` outside a GraphProvider.
 */
export function useMaybeGraph(): GraphContextValue | null {
  return use(GraphContext)
}
