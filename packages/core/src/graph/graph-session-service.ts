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

/**

 * Lifecycle of the active graph (Plan 02 loading gate).

 */
export type GraphStatus = 'loading' | 'choosing' | 'opening' | 'ready'

/**

 * Why the active graph's in-memory leftovers can go.

 */
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
  /**
   * True while the background index reconcile is running (Plan 06b).
   */
  readonly indexing: boolean
  readonly error: string | null
  readonly recents: RecentGraph[]
  /**
   * The open graph as one object; null while no graph is open. Its `signal`
   * aborts when the graph closes or another open is requested.
   */
  readonly session: GraphSession | null
  /**
   * The graph-scoped services of `session`; null whenever `session` is null or ended.
   */
  readonly services: Services | null
}

/**

 * What the host does at fixed points of {@link GraphSessionService.boot}.

 */
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
  /**
   * Refresh the recents list. `surfaceErrors` publishes a failed read as the error.
   */
  loadRecents: (options?: { surfaceErrors?: boolean }) => Promise<RecentGraph[]>
  /**
   * Open a graph by its root path. Resolves true only when it reached 'ready'.
   */
  openRecent: (root: string) => Promise<boolean>
  /**
   * Create (and open) a graph at an app-chosen absolute path. Resolves true
   * only on a confirmed open.
   */
  createGraphAt: (root: string) => Promise<boolean>
  /**
   * Show the OS folder picker, then open (and bootstrap) the chosen graph.
   */
  pickAndOpen: () => Promise<void>
  /**
   * Close the active graph and show the graph chooser.
   */
  chooseGraph: () => Promise<void>
  /**
   * Drop a graph from the recents list.
   */
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
  /**
   * Stop at 'choosing' with `error`: the host's boot path could not open a graph.
   */
  park: (error: string | null) => void
  /**
   * Listen for the point where the previous graph's in-memory leftovers can
   * go: `switch` once another graph's backend open settled the old index pass,
   * `close` once the active graph's index closed.
   */
  onGraphReleased: (listener: (reason: GraphReleaseReason) => void) => Unlisten
  /**
   * Listen for a graph directory that went to the trash.
   */
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

/**

 * Commands that return `()` from Rust serialize as `null` over IPC.

 */
const voidSchema = z.null()

class GraphSessionServiceImpl<Services = unknown> implements GraphSessionService<Services> {
  readonly #deps: GraphSessionServiceDeps<Services>
  readonly #listeners = new Set<() => void>()
  readonly #releasedListeners = new Set<(reason: GraphReleaseReason) => void>()
  readonly #deletedListeners = new Set<(root: string) => void>()
  #state: GraphSessionState<Services> = {
    status: 'loading',
    graph: null,
    indexGeneration: null,
    indexing: false,
    error: null,
    recents: [],
    session: null,
    services: null,
  }
  // Monotonic open token: only the most recent open may commit `graph`/`status`,
  // so overlapping opens (double-click, StrictMode remount) can't finish out of
  // order and leave us on a graph the user didn't pick last.
  #openSeq = 0
  // Serializes backend opens (see `openRecent`).
  #openChain: Promise<unknown> = Promise.resolve()
  // Aborts the published session's signal.
  #sessionAbort: AbortController | null = null
  // How many running boots follow the app lifecycle for mobile suspension.
  #suspensionFollowers = 0

  constructor(deps: GraphSessionServiceDeps<Services>) {
    this.#deps = deps
  }

  readonly getState = (): GraphSessionState<Services> => this.#state

  readonly subscribe = (listener: () => void): Unlisten => this.#attach(this.#listeners, listener)

  readonly onGraphReleased = (listener: (reason: GraphReleaseReason) => void): Unlisten =>
    this.#attach(this.#releasedListeners, listener)

  readonly onGraphDeleted = (listener: (root: string) => void): Unlisten =>
    this.#attach(this.#deletedListeners, listener)

  #attach<Listener>(set: Set<Listener>, listener: Listener): Unlisten {
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }

  #isMobile(): boolean {
    return isMobilePlatform(this.#deps.platform.appPlatform)
  }

  #setState(patch: Partial<GraphSessionState<Services>>): void {
    const next = { ...this.#state, ...patch }
    const keys = Object.keys(next) as (keyof GraphSessionState<Services>)[]
    if (keys.every((key) => next[key] === this.#state[key])) {
      return
    }
    const indexGenerationChanged = next.indexGeneration !== this.#state.indexGeneration
    this.#state = next
    if (
      indexGenerationChanged &&
      this.#suspensionFollowers > 0 &&
      this.#deps.lifecycle.isHidden()
    ) {
      this.#deps.indexLifecycle.suspend()
    }
    for (const listener of this.#listeners) {
      listener()
    }
  }

  /**

   * Invalidate every open in flight and the published session.

   */
  #supersede(): number {
    this.#openSeq += 1
    this.#sessionAbort?.abort()
    this.#sessionAbort = null
    return this.#openSeq
  }

  /**

   * The session object of an open graph.

   */
  #sessionFor(graph: GraphInfo, indexGeneration: number | null): GraphSession {
    const controller = new AbortController()
    this.#sessionAbort?.abort()
    this.#sessionAbort = controller
    return createGraphSession(
      { root: graph.root, name: graph.name, generation: graph.generation, indexGeneration },
      controller.signal,
    )
  }

  /**

   * Publish `graph` as ready, then the graph-scoped services of its session.

   */
  #commitReady(graph: GraphInfo, indexGeneration: number | null, role: GraphRole): GraphSession {
    const session = this.#sessionFor(graph, indexGeneration)
    this.#setState({ graph, indexGeneration, status: 'ready', session, services: null })
    const { createServices } = this.#deps
    if (createServices !== undefined && !session.signal.aborted) {
      this.#setState({ services: createServices(session, role) })
    }
    return session
  }

  /**

   * The prior graph's in-memory leftovers can go.

   */
  #release(reason: GraphReleaseReason): void {
    this.#deps.noteRows.reset()
    for (const listener of this.#releasedListeners) {
      listener(reason)
    }
  }

  /**
   * Guard for graph-session mutations only the main window may run: opening,
   * switching, or deleting a graph re-roots the shared Rust `GraphState` under
   * every window at once.
   */
  #requireMainWindow(action: string): boolean {
    if (this.#deps.window.isMainWindow()) {
      return true
    }
    this.#deps.logger.warn(`${action} is only available from the main window`)
    return false
  }

  /**
   * Close every note window before a graph switch or delete replaces the
   * session they adopted. Must run BEFORE anything bumps the graph/index
   * generations: each child's close-requested flush lands against the
   * still-valid session. A no-op on mobile, where secondary windows don't exist.
   */
  async #closeSecondaryWindows(): Promise<void> {
    if (this.#isMobile()) {
      return
    }
    await this.#deps.window.closeSecondaryWindows()
  }

  readonly loadRecents = async (options?: { surfaceErrors?: boolean }): Promise<RecentGraph[]> => {
    try {
      const list = await this.#deps.ipc.call('recent_graphs', {}, z.array(recentGraphSchema))
      this.#setState({ recents: list })
      return list
    } catch (err) {
      // Surface a real failure (e.g. a corrupt recent-graphs.json, which Rust
      // reports as an error rather than an empty list) only when this is the
      // primary load. As a post-open refresh it must not clobber an open error
      // or set one on a screen (the workspace) that never shows it.
      if (options?.surfaceErrors) {
        this.#setState({ error: errorMessage(err) })
      }
      return []
    }
  }

  readonly openRecent = (root: string): Promise<boolean> => {
    if (!this.#requireMainWindow('opening a graph')) {
      return Promise.resolve(false)
    }
    const seq = this.#supersede()
    this.#setState({ status: 'opening', error: null, services: null })
    // Resolves true only when this open actually reached 'ready': callers
    // (mobile onboarding) gate side effects like persisting the onboarded
    // flag on a confirmed open, never on a clone that failed to open.
    const run = async (): Promise<boolean> => {
      let opened = false
      try {
        await this.#closeSecondaryWindows() // before graph_open bumps the session
        const info = await this.#deps.ipc.call('graph_open', { path: root }, graphInfoSchema)
        if (seq !== this.#openSeq) {
          return false // superseded by a newer open
        }
        // Stop any prior reconcile and wait for it to fully settle before the
        // Rust index connection is swapped, so a stale pass can't write into
        // this graph's index.
        await this.#deps.indexLifecycle.stop()
        // Listeners reclaim what they hold for the prior graph. It is already
        // invisible here (scoped by generation / graph root), so this is
        // memory hygiene, not correctness.
        this.#release('switch')
        // Open the index *before* 'ready' so reads can't hit the previous
        // graph's index. Best-effort: an index failure doesn't block editing.
        const generation = await this.#deps.indexLifecycle.open()
        if (seq !== this.#openSeq) {
          return false
        }
        // Transition to 'ready' immediately: the user can start editing.
        const session = this.#commitReady(info, generation, 'main')
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
        if (generation !== null) {
          ensureWelcomeNote(
            {
              indexStore: this.#deps.indexStore,
              noteFile: this.#deps.noteFile,
              id: this.#deps.id,
            },
            { fileGeneration: info.generation, indexGeneration: generation },
          )
            .catch((err: unknown) => {
              this.#deps.logger.error('welcome seed failed:', errorMessage(err))
            })
            .finally(() => {
              if (!session.signal.aborted) {
                // Background-sync the index (reconcile → subscribe → watch),
                // bailing if a newer open supersedes this one.
                this.#deps.indexLifecycle.sync(session)
              }
            })
        } else {
          // No index: tear down any live lifecycle left from the prior graph.
          void this.#deps.indexLifecycle.close()
        }
      } catch (err) {
        if (seq !== this.#openSeq) {
          return false
        }
        this.#setState({ error: errorMessage(err), status: 'choosing' })
      }
      if (seq === this.#openSeq) {
        await this.loadRecents()
      }
      return opened
    }
    // `graph_open` mutates Rust's GraphState (`set_root`), so overlapping opens
    // could otherwise have a slow older call land *after* a newer one and leave
    // the backend on a different graph than the UI. Serialize them: running
    // one-at-a-time in request order makes the last-requested open the last to
    // touch GraphState, matching the `openSeq`-pinned UI.
    const next = this.#openChain.then(run, run)
    this.#openChain = next
    return next
  }

  readonly createGraphAt = async (root: string): Promise<boolean> => {
    // Guarded BEFORE the create: graph_create activates the shared Rust
    // session, so off-main it would re-root every window even though the
    // openRecent below refuses.
    if (!this.#requireMainWindow('creating a graph')) {
      return false
    }
    try {
      await this.#deps.mobileStorage.createGraph(root)
    } catch (err) {
      this.#setState({ error: errorMessage(err) })
      return false
    }
    return await this.openRecent(root)
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
  async #pickerDefaultPath(hasRecents: boolean): Promise<{ defaultPath: string } | null> {
    if (hasRecents || !this.#deps.platform.isMacosDesktop) {
      return null
    }
    try {
      return { defaultPath: await this.#deps.path.icloudDriveRoot() }
    } catch (err) {
      this.#deps.logger.warn('iCloud Drive picker suggestion failed:', errorMessage(err))
      return null
    }
  }

  readonly pickAndOpen = async (): Promise<void> => {
    let selected: string | null = null
    try {
      selected = await this.#deps.dialog.pickFolder({
        title: 'Choose a graph folder',
        ...(await this.#pickerDefaultPath(this.#state.recents.length > 0)),
      })
    } catch (err) {
      this.#setState({ error: errorMessage(err) })
      return
    }
    if (selected) {
      await this.openRecent(selected)
    }
  }

  async #closeActiveGraph(): Promise<void> {
    this.#supersede()
    await this.#deps.indexLifecycle.close()
    this.#release('close')
    this.#setState({
      graph: null,
      indexGeneration: null,
      indexing: false,
      error: null,
      status: 'choosing',
      session: null,
      services: null,
    })
  }

  readonly chooseGraph = async (): Promise<void> => {
    if (!this.#requireMainWindow('switching graphs')) {
      return
    }
    await this.#closeSecondaryWindows() // the session they adopted is ending
    await this.#closeActiveGraph()
    await this.loadRecents({ surfaceErrors: true })
  }

  readonly forgetRecent = async (root: string): Promise<void> => {
    const { graph } = this.#state
    try {
      await this.#deps.ipc.call('forget_recent', { root }, voidSchema)
      await this.loadRecents()
      if (graph?.root === root) {
        // Forgetting the ACTIVE graph ends the session its note windows
        // adopted: same close-first rule as switch/delete.
        await this.#closeSecondaryWindows()
        await this.#closeActiveGraph()
      }
    } catch {
      // best-effort
    }
  }

  readonly deleteGraph = async (): Promise<void> => {
    if (!this.#deps.window.isMainWindow()) {
      throw new Error('Deleting a graph is only available from the main window.')
    }
    const { graph } = this.#state
    if (graph === null) {
      return
    }
    const { root, generation } = graph
    // A newer open while the delete is in flight supersedes it (the Rust
    // side already refuses the stale generation): never tear down or
    // re-open the graph the user switched to.
    const seq = this.#openSeq
    try {
      await this.#closeSecondaryWindows() // before the delete invalidates the session
      // Pinned to `generation` so a delete can never race a graph switch and
      // trash the newly opened graph.
      await this.#deps.ipc.call('graph_delete', { generation }, voidSchema)
    } catch (err) {
      // The command invalidates the Rust session before touching the
      // filesystem, so a failed trash leaves the directory intact but the
      // session pin dead: re-open the graph to restore a writable session,
      // then let the caller surface the error.
      if (seq === this.#openSeq) {
        await this.openRecent(root)
      }
      throw err
    }
    for (const listener of this.#deletedListeners) {
      listener(root)
    }
    if (seq === this.#openSeq) {
      await this.#closeActiveGraph()
    }
    await this.loadRecents()
  }

  readonly refreshIndex = (): void => {
    const { session } = this.#state
    // Off-main, a refresh would start a second concurrent index writer.
    if (session === null || session.indexGeneration === null || !this.#deps.window.isMainWindow()) {
      return
    }
    // The index lifecycle coalesces stacked triggers (resume + poll-end +
    // watch-failed can fire together) into a single queued rerun.
    this.#deps.indexLifecycle.refresh(session)
  }

  readonly park = (error: string | null): void => {
    this.#setState({ error, status: 'choosing' })
  }

  /**
   * Mobile main window: keep index writes off while the app is hidden, and
   * recover what was missed on the way back.
   */
  #followSuspension(): Unlisten {
    if (!this.#isMobile() || !this.#deps.window.isMainWindow()) {
      return () => {}
    }
    this.#suspensionFollowers += 1
    if (this.#deps.lifecycle.isHidden()) {
      this.#deps.indexLifecycle.suspend()
    }
    // Synchronous teardown prevents a locally emitted or metadata-watcher
    // batch from entering the index queue after iOS begins suspension.
    const stopHidden = this.#deps.lifecycle.subscribeHidden(() => {
      this.#deps.indexLifecycle.suspend()
    })
    const stopVisible = this.#deps.lifecycle.subscribeVisible(() => {
      // A null session still clears suspension: mobile can foreground
      // before onboarding/open has produced an index session. With a session,
      // the full pass recovers every event missed while hidden; stacked
      // resume/iCloud triggers fold into the lifecycle's queued rerun.
      this.#deps.indexLifecycle.resume(this.#state.session)
    })
    return () => {
      this.#suspensionFollowers -= 1
      stopHidden()
      stopVisible()
    }
  }

  readonly boot = (hooks?: GraphBootHooks): Unlisten => {
    let active = true
    // The lifecycle events perform the active teardown; this dynamic guard
    // also closes the launch race where the first sync is scheduled after iOS
    // has already hidden the webview.
    this.#deps.indexLifecycle.setSuspendGuard(
      () => this.#isMobile() && this.#deps.lifecycle.isHidden(),
    )
    const unlisteners = [
      this.#deps.indexLifecycle.onProgress((progress) => {
        this.#setState({ indexing: progress === 'reconciling' })
      }),
      this.#followSuspension(),
      // A structural vault change (folder created, renamed, or removed) cannot
      // be expressed as per-file events; the watcher asks for one full
      // reconcile instead, and `refresh` coalesces bursts into a single queued
      // rerun.
      this.#deps.fileChanges.subscribeReconcile(() => {
        this.refreshIndex()
      }),
      // A completed reconcile read changed files into the index without
      // per-file events; open sessions re-read so the visible note converges
      // with the index (unchanged files are no-op reads).
      this.#deps.indexLifecycle.onReconciled((event) => {
        if (event.source === 'sync') {
          this.#deps.openDocuments.reloadAll()
        }
      }),
      // External renames healed by id follow through to sessions and routes,
      // exactly as for an in-app rename (Plan 17).
      this.#deps.indexLifecycle.onMoved((from, to) => {
        this.#deps.noteMove.followHealedMove(from, to)
      }),
      // iCloud-evicted notes whose content the index lacks: request exactly
      // those downloads; the materialized files index via ordinary watcher
      // upserts. Rust resolves against the active root itself.
      this.#deps.indexLifecycle.onStalePlaceholders((paths) => {
        this.#deps.icloudNative.requestDownloads(paths).catch((err: unknown) => {
          this.#deps.logger.error('iCloud download request failed:', errorMessage(err))
        })
      }),
    ]

    if (!this.#isMobile() && this.#deps.window.isMainWindow()) {
      // Desktop main window: reopen the most recent graph so the app resumes
      // where the user left off, or park on the chooser.
      void (async () => {
        const list = await this.loadRecents({ surfaceErrors: true })
        if (!active) {
          return
        }
        if (list.length > 0) {
          await this.openRecent(list[0]!.root)
        } else {
          this.#setState({ status: 'choosing' })
        }
      })()
    } else if (!this.#isMobile()) {
      // A secondary note window ADOPTS the main window's open session, never
      // `graph_open`/`index_open`, whose generation bumps would strand every
      // command the main window has pinned, and runs no index lifecycle of
      // its own.
      void (async () => {
        try {
          const adopted = await this.#deps.window.bootstrap()
          hooks?.onWindowBootstrap?.(adopted)
          if (!active) {
            return
          }
          this.#commitReady(adopted.graph, adopted.indexGeneration, 'note-window')
        } catch (err) {
          if (active) {
            // Off-main, 'choosing' renders as an error screen, never the
            // chooser: choosing here would re-root every other window.
            this.#setState({ error: errorMessage(err), status: 'choosing' })
          }
        }
      })()
    }

    return () => {
      active = false
      for (const unlisten of unlisteners) {
        unlisten()
      }
      this.#deps.indexLifecycle.setSuspendGuard(null)
    }
  }
}

export function createGraphSessionService<Services = unknown>(
  deps: GraphSessionServiceDeps<Services>,
): GraphSessionService<Services> {
  return new GraphSessionServiceImpl(deps)
}
