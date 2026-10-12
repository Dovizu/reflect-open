import { createContext, use, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import {
  createGraphServices,
  type AppPlatform,
  type GraphInfo,
  type GraphStatus,
  type RecentGraph,
} from '@reflect/core'
import { GraphServicesProvider, useAppServices } from '@/services/services-provider.tsx'
import { bindGraphIndex } from './graph-index.ts'
import { bootGraphSession } from './graph-session.ts'
import { useMobileGraphBoot, type MobileGraphBoot } from './use-mobile-graph-boot.ts'

export type { GraphStatus } from '@reflect/core'

/**
 * The graph context surface. The mobile-only slice (`needsOnboarding`,
 * storage roots, `completeOnboarding`) is documented on
 * {@link MobileGraphBoot}, whose hook owns it.
 */
interface GraphContextValue extends MobileGraphBoot {
  /**
   * Which UI family the shell was built for (Plan 19's root gate), fixed at
   * boot; gates platform-only surfaces like the iOS subscription paywall.
   */
  platform: AppPlatform
  status: GraphStatus
  graph: GraphInfo | null
  recents: RecentGraph[]
  /**
   * The open **index session** generation (from `index_open`) — distinct from
   * `graph.generation` (the file-write generation): the two counters are
   * independent in Rust. Index-gated commands (`index_*`, `embed_*`,
   * `db_query` writes via the pipelines) must echo THIS one; `note_write`
   * and friends take `graph.generation`. Null when the index failed to open.
   */
  indexGeneration: number | null
  /** True while the background index reconcile is running (Plan 06b). */
  indexing: boolean
  error: string | null
  /** Show the OS folder picker, then open (and bootstrap) the chosen graph. */
  pickAndOpen: () => Promise<void>
  /** Close the active graph and show the desktop graph chooser. */
  chooseGraph: () => Promise<void>
  /**
   * Create (and open) a graph at an app-chosen absolute path — desktop
   * onboarding's iCloud path names the folder inside the container instead
   * of showing a picker. Resolves true only on a confirmed open.
   */
  createAt: (root: string) => Promise<boolean>
  /** Open a graph by its root path. Resolves true only when it reached 'ready'. */
  openRecent: (root: string) => Promise<boolean>
  /** Drop a graph from the recents list. */
  forget: (root: string) => Promise<void>
  /**
   * Move the open graph's directory to the OS trash (recoverable), drop it
   * from recents, and return to the chooser. Throws when the delete fails so
   * the settings confirm dialog can surface the error. Desktop-only.
   */
  deleteGraph: () => Promise<void>
  /**
   * Re-run the open graph's background index reconcile. External writers the
   * watcher can't see (mobile has none; iCloud lands files behind the app's
   * back) call this after nudging downloads so arrived files get indexed.
   * No-op while no index is open.
   */
  refreshIndex: () => void
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
  const {
    status,
    graph,
    recents,
    indexGeneration,
    indexing,
    error,
    session: graphSession,
  } = useSyncExternalStore(session.subscribe, session.getState)
  // Graph-scoped services exist per open session, over the app services.
  const graphServices = useMemo(
    () =>
      graphSession === null
        ? null
        : createGraphServices(
            app,
            graphSession,
            app.window.isMainWindow() ? 'main' : 'note-window',
          ),
    [app, graphSession],
  )

  // What the app does when the active graph's index reports.
  useEffect(() => bindGraphIndex(app), [app])

  // Desktop main-window boot reopens the most recent graph or shows the
  // chooser; a secondary note window adopts the main window's graph. Mobile
  // boots through its hook below.
  useEffect(() => bootGraphSession(app), [app])

  // The mobile bootstrap + onboarding slice (Plans 19/21) lives in its own
  // service; it opens and parks through the session.
  const {
    needsOnboarding,
    mobileStorageInfo,
    mobileStorageResolving,
    mobileStorageKind,
    completeOnboarding,
  } = useMobileGraphBoot()

  const value = useMemo<GraphContextValue>(
    () => ({
      platform,
      status,
      graph,
      recents,
      indexGeneration,
      indexing,
      error,
      pickAndOpen: session.pickAndOpen,
      chooseGraph: session.chooseGraph,
      createAt: session.createGraphAt,
      openRecent: session.openRecent,
      forget: session.forgetRecent,
      deleteGraph: session.deleteGraph,
      needsOnboarding,
      mobileStorageInfo,
      mobileStorageResolving,
      mobileStorageKind,
      completeOnboarding,
      refreshIndex: session.refreshIndex,
    }),
    [
      platform,
      status,
      graph,
      recents,
      indexGeneration,
      indexing,
      error,
      session,
      needsOnboarding,
      mobileStorageInfo,
      mobileStorageResolving,
      mobileStorageKind,
      completeOnboarding,
    ],
  )

  return (
    <GraphContext value={value}>
      <GraphServicesProvider services={graphServices}>{children}</GraphServicesProvider>
    </GraphContext>
  )
}

/** Access the active graph + open/choose actions. Use within a GraphProvider. */
export function useGraph(options: { optional: true }): GraphContextValue | null
export function useGraph(): GraphContextValue
export function useGraph(options?: { optional: true }): GraphContextValue | null {
  const context = use(GraphContext)
  if (!context && !options?.optional) {
    throw new Error('useGraph must be used within a GraphProvider')
  }
  return context
}
