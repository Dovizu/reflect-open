import { z } from 'zod'
import type { DialogService } from '../app/dialog-service.ts'
import { createGraphSession, type GraphRole, type GraphSession } from '../app/graph-session.ts'
import type { IdService } from '../app/id-service.ts'
import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { PathService } from '../app/path-service.ts'
import { isMobilePlatform } from '../app/platform.ts'
import type { PlatformFacts } from '../app/platform-service.ts'
import type { WindowService } from '../app/window-service.ts'
import type { NoteMoveService } from '../documents/note-move-service.ts'
import type { NoteRowService } from '../documents/note-row-service.ts'
import type { OpenDocumentsService } from '../documents/open-documents-service.ts'
import { errorMessage } from '../errors.ts'
import type { FileChangeService } from '../indexing/file-change-service.ts'
import type { IndexLifecycleService } from '../indexing/index-lifecycle-service.ts'
import type { IndexStoreService } from '../indexing/index-store-service.ts'
import type { ICloudNativeService } from '../ipc/icloud-native-service.ts'
import type { IpcBridgeService, Unlisten } from '../ipc/ipc-service.ts'
import type { MobileStorageService } from '../ipc/mobile-storage-service.ts'
import type { NoteFileService } from './note-file-service.ts'
import { ensureWelcomeNote } from './onboarding.ts'
import {
  graphInfoSchema,
  recentGraphSchema,
  type GraphInfo,
  type RecentGraph,
  type WindowBootstrap,
} from './schemas.ts'

/** Lifecycle of the active graph (Plan 02 loading gate). */
export type GraphStatus = 'loading' | 'choosing' | 'opening' | 'ready'

/** Why the active graph's in-memory leftovers can go. */
export type GraphReleaseReason = 'switch' | 'close'

/**
 * What a {@link GraphSessionService} publishes. Replaced, never mutated, on
 * every change. `Services` is what the graph-scoped container of a session is.
 */
export interface GraphSessionState<Services = unknown> {
  readonly status: GraphStatus
  readonly graph: GraphInfo | null
  /**
   * The open **index session** generation (from `index_open`), distinct from
   * `graph.generation` (the file-write generation): the two counters are
   * independent in Rust. Null when the index failed to open.
   */
  readonly indexGeneration: number | null
  /** True while the background index reconcile is running (Plan 06b). */
  readonly indexing: boolean
  readonly error: string | null
  readonly recents: RecentGraph[]
  /**
   * The open graph as one object. Null while no graph is open and while the
   * graph is open without an index session. Its `signal` aborts when the
   * graph closes or another open is requested.
   */
  readonly session: GraphSession | null
  /** The graph-scoped services of `session`; null whenever `session` is null or ended. */
  readonly services: Services | null
}

/** What the host does at fixed points of {@link GraphSessionService.boot}. */
export interface GraphBootHooks {
  /**
   * A note window read the main window's sessions. Runs before the adoption
   * commits, and also when the boot was stopped meanwhile: the shell drains
   * the pending deep link on the read, so only this call can act on it.
   */
  onWindowBootstrap?: (boot: WindowBootstrap) => void
}

/**
 * The active graph of this webview: its identity, both session generations,
 * the open, create, switch, forget and delete flows, the recents list, and
 * the boot paths. Members are function properties so surfaces can pass them
 * around unbound.
 */
export interface GraphSessionService<Services = unknown> {
  getState: () => GraphSessionState<Services>
  subscribe: (listener: () => void) => Unlisten
  /**
   * Start this webview's graph: follow the index lifecycle, then run the boot
   * path of the window. The desktop main window reopens the most recent graph
   * or parks on the chooser. A note window adopts the main window's sessions.
   * A mobile window waits for its host to call {@link openRecent} or
   * {@link park}. The returned function stops the boot and the following.
   */
  boot: (hooks?: GraphBootHooks) => Unlisten
  /** Refresh the recents list. `surfaceErrors` publishes a failed read as the error. */
  loadRecents: (options?: { surfaceErrors?: boolean }) => Promise<RecentGraph[]>
  /** Open a graph by its root path. Resolves true only when it reached 'ready'. */
  openRecent: (root: string) => Promise<boolean>
  /**
   * Create (and open) a graph at an app-chosen absolute path. Resolves true
   * only on a confirmed open.
   */
  createGraphAt: (root: string) => Promise<boolean>
  /** Show the OS folder picker, then open (and bootstrap) the chosen graph. */
  pickAndOpen: () => Promise<void>
  /** Close the active graph and show the graph chooser. */
  chooseGraph: () => Promise<void>
  /** Drop a graph from the recents list. */
  forgetRecent: (root: string) => Promise<void>
  /**
   * Move the open graph's directory to the OS trash (recoverable), drop it
   * from recents, and return to the chooser. Throws when the delete fails.
   * Desktop-only.
   */
  deleteGraph: () => Promise<void>
  /**
   * Re-run the open graph's background index reconcile. No-op while no index
   * is open and outside the main window.
   */
  refreshIndex: () => void
  /** Stop at 'choosing' with `error`: the host's boot path could not open a graph. */
  park: (error: string | null) => void
  /**
   * Listen for the point where the previous graph's in-memory leftovers can
   * go: `switch` once another graph's backend open settled the old index pass,
   * `close` once the active graph's index closed.
   */
  onGraphReleased: (listener: (reason: GraphReleaseReason) => void) => Unlisten
  /** Listen for a graph directory that went to the trash. */
  onGraphDeleted: (listener: (root: string) => void) => Unlisten
}

export interface GraphSessionServiceDeps<Services = unknown> {
  readonly ipc: IpcBridgeService
  readonly indexLifecycle: IndexLifecycleService
  readonly indexStore: IndexStoreService
  readonly noteFile: NoteFileService
  readonly id: IdService
  readonly fileChanges: Pick<FileChangeService, 'subscribeReconcile'>
  readonly window: Pick<WindowService, 'isMainWindow' | 'closeSecondaryWindows' | 'bootstrap'>
  readonly dialog: Pick<DialogService, 'pickFolder'>
  readonly path: Pick<PathService, 'icloudDriveRoot'>
  readonly platform: Pick<PlatformFacts, 'appPlatform' | 'isMacosDesktop'>
  readonly lifecycle: Pick<AppLifecycleService, 'isHidden' | 'subscribeHidden' | 'subscribeVisible'>
  readonly mobileStorage: Pick<MobileStorageService, 'createGraph'>
  readonly noteRows: Pick<NoteRowService, 'reset'>
  readonly openDocuments: Pick<OpenDocumentsService, 'reloadAll'>
  readonly noteMove: Pick<NoteMoveService, 'followHealedMove'>
  readonly icloudNative: Pick<ICloudNativeService, 'requestDownloads'>
  readonly logger: LoggerService
  /**
   * Build the graph-scoped services of a session that just opened. They must
   * dispose themselves when `session.signal` aborts. Without it, `services`
   * stays null.
   */
  readonly createServices?: (session: GraphSession, role: GraphRole) => Services
}

/** Commands that return `()` from Rust serialize as `null` over IPC. */
const voidSchema = z.null()

export function createGraphSessionService<Services = unknown>(
  deps: GraphSessionServiceDeps<Services>,
): GraphSessionService<Services> {
  const {
    ipc,
    indexLifecycle: index,
    indexStore,
    noteFile,
    id,
    fileChanges,
    window: windowService,
    dialog,
    path,
    platform,
    lifecycle,
    mobileStorage,
    noteRows,
    openDocuments,
    noteMove,
    icloudNative,
    logger,
    createServices,
  } = deps

  let state: GraphSessionState<Services> = {
    status: 'loading',
    graph: null,
    indexGeneration: null,
    indexing: false,
    error: null,
    recents: [],
    session: null,
    services: null,
  }
  const listeners = new Set<() => void>()
  const releasedListeners = new Set<(reason: GraphReleaseReason) => void>()
  const deletedListeners = new Set<(root: string) => void>()

  // Monotonic open token: only the most recent open may commit `graph`/`status`,
  // so overlapping opens (double-click, StrictMode remount) can't finish out of
  // order and leave us on a graph the user didn't pick last.
  let openSeq = 0
  // Serializes backend opens (see `openRecent`).
  let openChain: Promise<unknown> = Promise.resolve()
  // Aborts the published session's signal.
  let sessionAbort: AbortController | null = null
  // How many running boots follow the app lifecycle for mobile suspension.
  let suspensionFollowers = 0

  function attach<Listener>(set: Set<Listener>, listener: Listener): Unlisten {
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }

  function isMobile(): boolean {
    return isMobilePlatform(platform.appPlatform)
  }

  function setState(patch: Partial<GraphSessionState<Services>>): void {
    const next = { ...state, ...patch }
    const keys = Object.keys(next) as (keyof GraphSessionState<Services>)[]
    if (keys.every((key) => next[key] === state[key])) {
      return
    }
    const indexGenerationChanged = next.indexGeneration !== state.indexGeneration
    state = next
    if (indexGenerationChanged && suspensionFollowers > 0 && lifecycle.isHidden()) {
      index.suspend()
    }
    for (const listener of listeners) {
      listener()
    }
  }

  /** Invalidate every open in flight and the published session. */
  function supersede(): number {
    openSeq += 1
    sessionAbort?.abort()
    sessionAbort = null
    return openSeq
  }

  /** The session object of an open graph; null when its index failed to open. */
  function sessionFor(graph: GraphInfo, indexGeneration: number | null): GraphSession | null {
    if (indexGeneration === null) {
      return null
    }
    const controller = new AbortController()
    sessionAbort?.abort()
    sessionAbort = controller
    return createGraphSession(
      { root: graph.root, name: graph.name, generation: graph.generation, indexGeneration },
      controller.signal,
    )
  }

  /** Publish `graph` as ready, then the graph-scoped services of its session. */
  function commitReady(
    graph: GraphInfo,
    indexGeneration: number | null,
    role: GraphRole,
  ): GraphSession | null {
    const session = sessionFor(graph, indexGeneration)
    setState({ graph, indexGeneration, status: 'ready', session, services: null })
    if (session !== null && createServices !== undefined && !session.signal.aborted) {
      setState({ services: createServices(session, role) })
    }
    return session
  }

  /** The prior graph's in-memory leftovers can go. */
  function release(reason: GraphReleaseReason): void {
    noteRows.reset()
    for (const listener of releasedListeners) {
      listener(reason)
    }
  }

  /**
   * Guard for graph-session mutations only the main window may run: opening,
   * switching, or deleting a graph re-roots the shared Rust `GraphState` under
   * every window at once.
   */
  function requireMainWindow(action: string): boolean {
    if (windowService.isMainWindow()) {
      return true
    }
    logger.warn(`${action} is only available from the main window`)
    return false
  }

  /**
   * Close every note window before a graph switch or delete replaces the
   * session they adopted. Must run BEFORE anything bumps the graph/index
   * generations: each child's close-requested flush lands against the
   * still-valid session. A no-op on mobile, where secondary windows don't exist.
   */
  async function closeSecondaryWindows(): Promise<void> {
    if (isMobile()) {
      return
    }
    await windowService.closeSecondaryWindows()
  }

  async function loadRecents(options?: { surfaceErrors?: boolean }): Promise<RecentGraph[]> {
    try {
      const list = await ipc.call('recent_graphs', {}, z.array(recentGraphSchema))
      setState({ recents: list })
      return list
    } catch (err) {
      // Surface a real failure (e.g. a corrupt recent-graphs.json, which Rust
      // reports as an error rather than an empty list) only when this is the
      // primary load. As a post-open refresh it must not clobber an open error
      // or set one on a screen (the workspace) that never shows it.
      if (options?.surfaceErrors) {
        setState({ error: errorMessage(err) })
      }
      return []
    }
  }

  function openRecent(root: string): Promise<boolean> {
    if (!requireMainWindow('opening a graph')) {
      return Promise.resolve(false)
    }
    const seq = supersede()
    setState({ status: 'opening', error: null, services: null })
    // Resolves true only when this open actually reached 'ready': callers
    // (mobile onboarding) gate side effects like persisting the onboarded
    // flag on a confirmed open, never on a clone that failed to open.
    const run = async (): Promise<boolean> => {
      let opened = false
      try {
        await closeSecondaryWindows() // before graph_open bumps the session
        const info = await ipc.call('graph_open', { path: root }, graphInfoSchema)
        if (seq !== openSeq) {
          return false // superseded by a newer open
        }
        // Stop any prior reconcile and wait for it to fully settle before the
        // Rust index connection is swapped, so a stale pass can't write into
        // this graph's index.
        await index.stop()
        // Listeners reclaim what they hold for the prior graph. It is already
        // invisible here (scoped by generation / graph root), so this is
        // memory hygiene, not correctness.
        release('switch')
        // Open the index *before* 'ready' so reads can't hit the previous
        // graph's index. Best-effort: an index failure doesn't block editing.
        const generation = await index.open()
        if (seq !== openSeq) {
          return false
        }
        // Transition to 'ready' immediately: the user can start editing.
        const session = commitReady(info, generation, 'main')
        opened = true
        // Onboarding, considered exactly once per graph (the `welcomeSeeded`
        // meta marker): an empty graph gets the pinned "How to use Reflect"
        // note. Needs the index for the marker, so a graph whose index failed
        // to open simply tries again next time. On all launches after the
        // first, ensureWelcomeNote returns immediately (marker already set),
        // so it no longer blocks time-to-first-workspace-paint. The note must
        // land before the reconcile indexes files: index.sync starts in the
        // .finally so it always runs after the seed attempt.
        // Best-effort: a failed seed must never block opening.
        if (session !== null) {
          ensureWelcomeNote(
            { indexStore, noteFile, id },
            { fileGeneration: info.generation, indexGeneration: session.indexGeneration },
          )
            .catch((err: unknown) => {
              logger.error('welcome seed failed:', errorMessage(err))
            })
            .finally(() => {
              if (!session.signal.aborted) {
                // Background-sync the index (reconcile → subscribe → watch),
                // bailing if a newer open supersedes this one.
                index.sync(session)
              }
            })
        } else {
          // No index: tear down any live lifecycle left from the prior graph.
          void index.close()
        }
      } catch (err) {
        if (seq !== openSeq) {
          return false
        }
        setState({ error: errorMessage(err), status: 'choosing' })
      }
      if (seq === openSeq) {
        await loadRecents()
      }
      return opened
    }
    // `graph_open` mutates Rust's GraphState (`set_root`), so overlapping opens
    // could otherwise have a slow older call land *after* a newer one and leave
    // the backend on a different graph than the UI. Serialize them: running
    // one-at-a-time in request order makes the last-requested open the last to
    // touch GraphState, matching the `openSeq`-pinned UI.
    const next = openChain.then(run, run)
    openChain = next
    return next
  }

  async function createGraphAt(root: string): Promise<boolean> {
    // Guarded BEFORE the create: graph_create activates the shared Rust
    // session, so off-main it would re-root every window even though the
    // openRecent below refuses.
    if (!requireMainWindow('creating a graph')) {
      return false
    }
    try {
      await mobileStorage.createGraph(root)
    } catch (err) {
      setState({ error: errorMessage(err) })
      return false
    }
    return await openRecent(root)
  }

  /**
   * On a macOS first run (no recents yet), start the folder picker in iCloud
   * Drive, the recommended home for a graph (Plan 21): notes back up
   * automatically and the iOS app's container lives there too. Suggestion
   * only: the user can navigate anywhere, and once they have a graph the
   * picker reverts to the OS default (their last-used location). Best-effort:
   * a resolution failure (or a signed-out account's missing folder, which the
   * open panel falls back from on its own) must never block picking.
   */
  async function pickerDefaultPath(hasRecents: boolean): Promise<{ defaultPath: string } | null> {
    if (hasRecents || !platform.isMacosDesktop) {
      return null
    }
    try {
      return { defaultPath: await path.icloudDriveRoot() }
    } catch (err) {
      logger.warn('iCloud Drive picker suggestion failed:', errorMessage(err))
      return null
    }
  }

  async function pickAndOpen(): Promise<void> {
    let selected: string | null = null
    try {
      selected = await dialog.pickFolder({
        title: 'Choose a graph folder',
        ...(await pickerDefaultPath(state.recents.length > 0)),
      })
    } catch (err) {
      setState({ error: errorMessage(err) })
      return
    }
    if (selected) {
      await openRecent(selected)
    }
  }

  async function closeActiveGraph(): Promise<void> {
    supersede()
    await index.close()
    release('close')
    setState({
      graph: null,
      indexGeneration: null,
      indexing: false,
      error: null,
      status: 'choosing',
      session: null,
      services: null,
    })
  }

  async function chooseGraph(): Promise<void> {
    if (!requireMainWindow('switching graphs')) {
      return
    }
    await closeSecondaryWindows() // the session they adopted is ending
    await closeActiveGraph()
    await loadRecents({ surfaceErrors: true })
  }

  async function forgetRecent(root: string): Promise<void> {
    const { graph } = state
    try {
      await ipc.call('forget_recent', { root }, voidSchema)
      await loadRecents()
      if (graph?.root === root) {
        // Forgetting the ACTIVE graph ends the session its note windows
        // adopted: same close-first rule as switch/delete.
        await closeSecondaryWindows()
        await closeActiveGraph()
      }
    } catch {
      // best-effort
    }
  }

  async function deleteGraph(): Promise<void> {
    if (!windowService.isMainWindow()) {
      throw new Error('Deleting a graph is only available from the main window.')
    }
    const { graph } = state
    if (graph === null) {
      return
    }
    const { root, generation } = graph
    // A newer open while the delete is in flight supersedes it (the Rust
    // side already refuses the stale generation): never tear down or
    // re-open the graph the user switched to.
    const seq = openSeq
    try {
      await closeSecondaryWindows() // before the delete invalidates the session
      // Pinned to `generation` so a delete can never race a graph switch and
      // trash the newly opened graph.
      await ipc.call('graph_delete', { generation }, voidSchema)
    } catch (err) {
      // The command invalidates the Rust session before touching the
      // filesystem, so a failed trash leaves the directory intact but the
      // session pin dead: re-open the graph to restore a writable session,
      // then let the caller surface the error.
      if (seq === openSeq) {
        await openRecent(root)
      }
      throw err
    }
    for (const listener of deletedListeners) {
      listener(root)
    }
    if (seq === openSeq) {
      await closeActiveGraph()
    }
    await loadRecents()
  }

  function refreshIndex(): void {
    const { session } = state
    // Off-main, a refresh would start a second concurrent index writer.
    if (session === null || !windowService.isMainWindow()) {
      return
    }
    // The index lifecycle coalesces stacked triggers (resume + poll-end +
    // watch-failed can fire together) into a single queued rerun.
    index.refresh(session)
  }

  function park(error: string | null): void {
    setState({ error, status: 'choosing' })
  }

  /**
   * Mobile main window: keep index writes off while the app is hidden, and
   * recover what was missed on the way back.
   */
  function followSuspension(): Unlisten {
    if (!isMobile() || !windowService.isMainWindow()) {
      return () => {}
    }
    suspensionFollowers += 1
    if (lifecycle.isHidden()) {
      index.suspend()
    }
    // Synchronous teardown prevents a locally emitted or metadata-watcher
    // batch from entering the index queue after iOS begins suspension.
    const stopHidden = lifecycle.subscribeHidden(() => {
      index.suspend()
    })
    const stopVisible = lifecycle.subscribeVisible(() => {
      // A null session still clears suspension: mobile can foreground
      // before onboarding/open has produced an index session. With a session,
      // the full pass recovers every event missed while hidden; stacked
      // resume/iCloud triggers fold into the lifecycle's queued rerun.
      index.resume(state.session)
    })
    return () => {
      suspensionFollowers -= 1
      stopHidden()
      stopVisible()
    }
  }

  function boot(hooks?: GraphBootHooks): Unlisten {
    let active = true
    // The lifecycle events perform the active teardown; this dynamic guard
    // also closes the launch race where the first sync is scheduled after iOS
    // has already hidden the webview.
    index.setSuspendGuard(() => isMobile() && lifecycle.isHidden())
    const unlisteners = [
      index.onProgress((progress) => {
        setState({ indexing: progress === 'reconciling' })
      }),
      followSuspension(),
      // A structural vault change (folder created, renamed, or removed) cannot
      // be expressed as per-file events; the watcher asks for one full
      // reconcile instead, and `refresh` coalesces bursts into a single queued
      // rerun.
      fileChanges.subscribeReconcile(() => {
        refreshIndex()
      }),
      // A completed reconcile read changed files into the index without
      // per-file events; open sessions re-read so the visible note converges
      // with the index (unchanged files are no-op reads).
      index.onReconciled((event) => {
        if (event.source === 'sync') {
          openDocuments.reloadAll()
        }
      }),
      // External renames healed by id follow through to sessions and routes,
      // exactly as for an in-app rename (Plan 17).
      index.onMoved((from, to) => {
        noteMove.followHealedMove(from, to)
      }),
      // iCloud-evicted notes whose content the index lacks: request exactly
      // those downloads; the materialized files index via ordinary watcher
      // upserts. Rust resolves against the active root itself.
      index.onStalePlaceholders((paths) => {
        icloudNative.requestDownloads(paths).catch((err: unknown) => {
          logger.error('iCloud download request failed:', errorMessage(err))
        })
      }),
    ]

    if (!isMobile() && windowService.isMainWindow()) {
      // Desktop main window: reopen the most recent graph so the app resumes
      // where the user left off, or park on the chooser.
      void (async () => {
        const list = await loadRecents({ surfaceErrors: true })
        if (!active) {
          return
        }
        if (list.length > 0) {
          await openRecent(list[0]!.root)
        } else {
          setState({ status: 'choosing' })
        }
      })()
    } else if (!isMobile()) {
      // A secondary note window ADOPTS the main window's open session, never
      // `graph_open`/`index_open`, whose generation bumps would strand every
      // command the main window has pinned, and runs no index lifecycle of
      // its own.
      void (async () => {
        try {
          const adopted = await windowService.bootstrap()
          hooks?.onWindowBootstrap?.(adopted)
          if (!active) {
            return
          }
          commitReady(adopted.graph, adopted.indexGeneration, 'note-window')
        } catch (err) {
          if (active) {
            // Off-main, 'choosing' renders as an error screen, never the
            // chooser: choosing here would re-root every other window.
            setState({ error: errorMessage(err), status: 'choosing' })
          }
        }
      })()
    }

    return () => {
      active = false
      for (const unlisten of unlisteners) {
        unlisten()
      }
      index.setSuspendGuard(null)
    }
  }

  return {
    getState: () => state,
    subscribe: (listener) => attach(listeners, listener),
    boot,
    loadRecents,
    openRecent,
    createGraphAt,
    pickAndOpen,
    chooseGraph,
    forgetRecent,
    deleteGraph,
    refreshIndex,
    park,
    onGraphReleased: (listener) => attach(releasedListeners, listener),
    onGraphDeleted: (listener) => attach(deletedListeners, listener),
  }
}
