import { defaultOperations, type OperationsService } from '../app/operations-service.ts'
import { errorMessage } from '../errors.ts'
import { isNotePath } from '../graph/paths.ts'
import { getBridge, hasBridge, type IpcBridge } from '../ipc/bridge.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import {
  defaultFileChanges,
  type FileChange,
  type FileChangeService,
} from './file-change-service.ts'
import { createNoteIndexer, defaultIndexingDeps, type IndexingDeps } from './indexer.ts'
import { createLiveIndex } from './live.ts'

/** Stage of the index lifecycle that failed. */
export type IndexLifecycleStage = 'open' | 'sync'

/** Live progress of the background sync, for UI surfacing (Plan 06b). */
export type IndexLifecycleProgress = 'reconciling' | 'live' | 'idle'

/** How far the running pass has advanced through the file listing. */
export interface IndexFileProgress {
  /** Files the pass has moved past (skipped or indexed). */
  readonly done: number
  /** Files in the listing. */
  readonly total: number
  /**
   * Files the pass has actually read so far (not skipped read-free). The
   * pill gates on this: a routine pass skips everything (`worked` stays 0)
   * and must never surface, no matter how large the graph.
   */
  readonly worked: number
}

/** Index rows changed at `generation`. */
export interface IndexAppliedEvent {
  /** The index generation the rows were written at. */
  readonly generation: number
  /**
   * The note paths of the applied watcher batch. `null` after a sync pass
   * commits: the pass reports no per-file list, so any row may have changed.
   */
  readonly paths: readonly string[] | null
}

/** One batch of file changes was applied to the index at `generation`. */
export interface IndexChangesAppliedEvent {
  /** The index generation the batch was applied at. */
  readonly generation: number
  /** The full batch: note changes and asset-file changes, each with its kind. */
  readonly changes: readonly FileChange[]
}

/** A whole-graph pass ran to completion at `generation`. */
export interface IndexReconciledEvent {
  /** The index generation the pass wrote at. */
  readonly generation: number
  /**
   * `sync` is a background sync pass (hash reconcile, or a rebuild for a
   * stale projection version). `rebuild` is a requested
   * {@link IndexLifecycleService.rebuildVisibly}, which wiped every derived
   * table first, the embedding tables included.
   */
  readonly source: 'sync' | 'rebuild'
}

/**
 * The active graph's index lifecycle: open, reconcile, subscribe to live
 * changes, start the watcher, coalesce refreshes, suspend and resume, publish
 * progress, and rebuild on request.
 *
 * Usage on a graph switch (the caller still gates on its own open token):
 *
 * ```ts
 * await index.stop()                       // halt the previous graph's sync pass
 * const generation = await index.open()    // open the new graph's index
 * if (stale) return
 * index.sync(generation, () => stale)      // background reconcile + live watch
 * await index.close()                      // no graph/index remains active
 * ```
 *
 * Every write carries the index `generation` returned by
 * {@link IndexLifecycleService.open}; Rust no-ops a write whose generation is
 * stale, so even a pass that races a connection swap can't corrupt the
 * newly-opened index. The lifecycle itself never throws: a failed stage is
 * logged.
 */
export interface IndexLifecycleService {
  /**
   * Open + migrate the index for the now-active graph and return its generation.
   * Best-effort: returns `null` (and logs the error) if the open fails, so
   * a broken index never blocks editing.
   */
  open: () => Promise<number | null>
  /**
   * Background-sync the open index at `generation`: sync the whole graph
   * (hash reconcile, or a full rebuild when the stored projection version is
   * stale), then subscribe to live file changes, then start the Rust watcher,
   * sequenced so the passes never write concurrently. `isStale` is checked
   * between steps and bails when a newer open supersedes this one. Call only
   * after the graph row is committed.
   */
  sync: (generation: number, isStale: () => boolean) => void
  /**
   * Re-run the sync pass, coalescing concurrent triggers (resume, poll-end,
   * watch-failed can fire together): while one refresh is settling, further
   * calls fold into a single queued rerun instead of stacking abort/restart
   * cycles — on a large graph each stacked cycle was a full pass.
   */
  refresh: (generation: number, isStale: () => boolean) => void
  /**
   * Abort the in-flight reconcile (if any) and wait for the sync pass to fully
   * settle, so a stale pass can't keep running into the next graph's open.
   */
  stop: () => Promise<void>
  /**
   * Wait for the current sync pass (if any) to finish, without aborting it.
   * The refresh coalescer serializes reruns off this.
   */
  settled: () => Promise<void>
  /**
   * Fully close the active index lifecycle: abort any reconcile, drop the live
   * subscription, stop the file watcher, and report idle progress.
   */
  close: () => Promise<void>
  /**
   * Suspend index writes for a backgrounded mobile app: abort the bulk pass
   * and drop the live subscription synchronously. A later
   * {@link IndexLifecycleService.resume} reconciles the whole graph, so file
   * events missed while suspended converge.
   */
  suspend: () => void
  /**
   * Resume after {@link IndexLifecycleService.suspend} and run one coalesced
   * full sync for anything that changed while the live subscription was
   * absent. A null generation clears suspension without starting work
   * (foreground can precede graph open).
   */
  resume: (generation: number | null, isStale: () => boolean) => void
  /**
   * Install a dynamic guard for platforms that must not start index work
   * while the app is suspended; `null` removes it. Checked at every lifecycle
   * boundary in addition to the explicit
   * {@link IndexLifecycleService.suspend} transition.
   */
  setSuspendGuard: (shouldSuspend: (() => boolean) | null) => void
  /**
   * Listen as the sync pass progresses. Bailed (superseded) passes emit
   * nothing further: the newer open's pass owns the indicator.
   */
  onProgress: (listener: (progress: IndexLifecycleProgress) => void) => Unlisten
  /**
   * Listen for index rows that actually changed: once when a sync pass
   * commits, then per applied watcher batch. Drives query-cache invalidation
   * (Plan 07): firing on raw file events instead would refetch stale rows.
   */
  onApplied: (listener: (event: IndexAppliedEvent) => void) => Unlisten
  /**
   * Apply `changes` to the index at `generation` now, without waiting for the
   * live subscription: files a pull wrote must reach the index even before
   * the watcher runs. Applying a batch the live subscription also applies is
   * idempotent. Resolves with the number of index mutations and reports
   * {@link IndexLifecycleService.onApplied} when there was any. `canApply` is
   * checked before every write; a rejection is the caller's to handle.
   */
  applyChanges: (
    changes: FileChange[],
    generation: number,
    canApply?: () => boolean,
  ) => Promise<number>
  /**
   * Listen for every batch of file changes after the index applied it: each
   * watcher batch (notes and asset files, even when no row changed) and the
   * notes that an asset description write re-indexed. A sync pass reports no
   * batch. The event carries each change's kind, so a follower can tell a
   * removed note from a changed one; it must drop events of a `generation`
   * other than its own.
   */
  onChangesApplied: (listener: (event: IndexChangesAppliedEvent) => void) => Unlisten
  /**
   * Listen for whole-graph passes that ran to completion. A sync pass reports
   * right after its {@link IndexLifecycleService.onApplied}; one that was
   * aborted, superseded, or suspended never reports. The pass reads changed
   * files straight into the index but emits no per-file change events, so
   * holders of in-memory file content (open note sessions) must be told to
   * re-read here; on iOS the resume reconcile is the only signal a remote edit
   * ever produces for an already-open note.
   *
   * A requested rebuild reports with `source: 'rebuild'` and stays in flight
   * until every listener's returned promise settles, so the work a listener
   * starts (re-embedding) is part of the same coalesced request.
   */
  onReconciled: (listener: (event: IndexReconciledEvent) => void | Promise<void>) => Unlisten
  /**
   * Listen for id-based heals that relocate a note's rows (Plan 17): an
   * external rename observed by the reconcile or a watcher batch. The app
   * carries live sessions and rewrites routes off this, exactly as for an
   * in-app rename.
   */
  onMoved: (listener: (from: string, to: string) => void) => Unlisten
  /**
   * Listen as a sync pass advances through the file listing (`done`,
   * `total`, `worked`): the substrate for a "Preparing your notes… 400 of
   * 3,000" surface during a first index. Superseded passes stop reporting.
   */
  onFileProgress: (listener: (done: number, total: number, worked: number) => void) => Unlisten
  /**
   * Listen for iCloud-evicted notes whose content the index lacks (see
   * `IndexPassOptions.onStalePlaceholders`). The app requests targeted
   * downloads for exactly these paths.
   */
  onStalePlaceholders: (listener: (paths: readonly string[]) => void) => Unlisten
  /**
   * The running sync pass's file progress, or `null` when no pass is
   * reconciling. Published apart from {@link IndexLifecycleService.onProgress}
   * on purpose: ticks arrive several times a second during a first index, and
   * only the status pill should re-render per tick.
   */
  fileProgress: () => IndexFileProgress | null
  /** Subscribe to {@link IndexLifecycleService.fileProgress} changes. */
  subscribeFileProgress: (listener: () => void) => Unlisten
  /**
   * Full index rebuild with user-visible status: wipe and re-derive the SQLite
   * projection from the markdown files, then report
   * {@link IndexLifecycleService.onReconciled} with `source: 'rebuild'`. The
   * index is a rebuildable cache: a full rebuild is always safe and never
   * touches the notes themselves. A failed rebuild fails its operation and
   * resolves without reporting.
   *
   * Requests coalesce while a rebuild runs: a second call at the same
   * generation (a double-click, or the palette and the settings button racing)
   * returns the in-flight pass instead of starting an overlapping wipe. A call
   * at a *different* generation starts fresh: the graph changed, and Rust's
   * generation gate drops the superseded pass's writes anyway.
   */
  rebuildVisibly: (generation: number) => Promise<void>
  /**
   * Read, parse, and index one note now, without waiting for the watcher. For
   * an in-app write whose row must be readable at once.
   */
  indexNote: (
    path: string,
    options: { generation: number; content?: string | undefined; mtime?: number | undefined },
  ) => Promise<void>
  /**
   * Re-index every note that references any of `assetPaths`, so an asset
   * description written after its notes were indexed reaches their search
   * rows. The re-applied notes report through
   * {@link IndexLifecycleService.onChangesApplied}.
   */
  reindexNotesReferencing: (assetPaths: readonly string[], generation: number) => Promise<void>
}

/** The services an {@link IndexLifecycleService} runs on. */
export interface IndexLifecycleDeps extends IndexingDeps {
  readonly fileChanges: FileChangeService
  readonly operations: OperationsService
}

/**
 * Create an {@link IndexLifecycleService}. Holds the in-flight sync's
 * `AbortController`, settlement promise, and the live-subscription unlisten
 * internally; one instance lives across graph switches.
 */
export function createIndexLifecycleService(deps: IndexLifecycleDeps): IndexLifecycleService {
  const { indexStore, fileChanges, operations, clock, logger } = deps
  const progressListeners = new Set<(progress: IndexLifecycleProgress) => void>()
  const appliedListeners = new Set<(event: IndexAppliedEvent) => void>()
  const changesAppliedListeners = new Set<(event: IndexChangesAppliedEvent) => void>()
  const reconciledListeners = new Set<(event: IndexReconciledEvent) => void | Promise<void>>()
  const movedListeners = new Set<(from: string, to: string) => void>()
  const fileProgressListeners = new Set<(done: number, total: number, worked: number) => void>()
  const stalePlaceholderListeners = new Set<(paths: readonly string[]) => void>()
  const fileProgressStoreListeners = new Set<() => void>()

  function attach<Listener>(listeners: Set<Listener>, listener: Listener): Unlisten {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function emitChangesApplied(changes: readonly FileChange[], generation: number): void {
    for (const listener of changesAppliedListeners) {
      listener({ generation, changes })
    }
  }

  const indexer = createNoteIndexer({ ...deps, emitChangesApplied })
  const liveIndex = createLiveIndex({ ...deps, emitChangesApplied })

  let currentFileProgress: IndexFileProgress | null = null

  function setFileProgress(progress: IndexFileProgress | null): void {
    if (
      progress?.done === currentFileProgress?.done &&
      progress?.total === currentFileProgress?.total &&
      progress?.worked === currentFileProgress?.worked
    ) {
      return
    }
    currentFileProgress = progress
    for (const listener of fileProgressStoreListeners) {
      listener()
    }
  }

  function emitProgress(progress: IndexLifecycleProgress): void {
    if (progress !== 'reconciling') {
      setFileProgress(null) // the pass finished (or went idle): clear the pill
    }
    for (const listener of progressListeners) {
      listener(progress)
    }
  }

  function emitApplied(event: IndexAppliedEvent): void {
    for (const listener of appliedListeners) {
      listener(event)
    }
  }

  function emitMoved(from: string, to: string): void {
    for (const listener of movedListeners) {
      listener(from, to)
    }
  }

  function reportError(stage: IndexLifecycleStage, error: unknown): void {
    logger.error(`index ${stage} failed:`, errorMessage(error))
  }

  let abort: AbortController | null = null
  let done: Promise<void> = Promise.resolve()
  let suspended = false
  let suspendGuard: (() => boolean) | null = null
  // Boxed so the async sync pass can read/replace the active subscription without
  // TS narrowing the closure-captured binding.
  const live: { unlisten: (() => void) | null } = { unlisten: null }

  function isSuspended(): boolean {
    return suspended || suspendGuard?.() === true
  }

  function suspend(): void {
    suspended = true
    abort?.abort()
    live.unlisten?.()
    live.unlisten = null
    emitProgress('idle')
  }

  function resume(generation: number | null, isStale: () => boolean): void {
    suspended = false
    if (generation !== null && !isStale()) {
      // Events intentionally dropped while suspended are recovered by the
      // full reconcile. `refresh` also folds a rapid resume/poll burst into a
      // single queued rerun when a prior pass is still settling.
      refresh(generation, isStale)
    }
  }

  async function stop(): Promise<void> {
    abort?.abort()
    await done.catch(() => {})
  }

  async function settled(): Promise<void> {
    await done.catch(() => {})
  }

  async function close(): Promise<void> {
    await stop()
    live.unlisten?.()
    live.unlisten = null
    suspended = false
    emitProgress('idle')
    await fileChanges.stopWatcher().catch(() => {})
  }

  async function open(): Promise<number | null> {
    try {
      return await indexStore.open()
    } catch (error) {
      reportError('open', error)
      return null
    }
  }

  function sync(generation: number, isStale: () => boolean): void {
    // Tear down the previous graph's live subscription unconditionally, so a
    // failed/absent open can't leave it bound to a different graph.
    live.unlisten?.()
    live.unlisten = null

    if (isSuspended()) {
      return
    }

    emitProgress('reconciling')
    const controller = new AbortController()
    abort = controller
    // Pass telemetry: `worked` (files actually read) is the one number that
    // says whether this launch took the expensive branch — a routine open
    // logs 0.
    const passStarted = clock.monotonicNow()
    let passTotal = 0
    let passWorked = 0
    done = (async () => {
      // A subscription created but not yet adopted (superseded mid-flight, or a
      // later step threw) is torn down in `finally` so listeners can't leak.
      let pending: (() => void) | null = null
      try {
        if (isSuspended()) {
          return
        }
        await indexer.sync({
          generation,
          signal: controller.signal,
          onMoved: emitMoved,
          // Guarded: opening a graph swaps the Rust root *before* this pass is
          // stopped, so a superseded pass could otherwise request its old
          // paths against the newly opened graph.
          onStalePlaceholders: (paths: readonly string[]) => {
            if (!controller.signal.aborted && !isStale() && !isSuspended()) {
              for (const listener of stalePlaceholderListeners) {
                listener(paths)
              }
            }
          },
          onFileProgress: (progressDone: number, total: number, worked: number) => {
            passTotal = total
            passWorked = worked
            if (!isStale()) {
              setFileProgress({ done: progressDone, total, worked })
              for (const listener of fileProgressListeners) {
                listener(progressDone, total, worked)
              }
            }
          },
        })
        // Superseded passes (aborted, stale under a newer open, or suspended
        // mid-flight) resolve early with partial counters — logging them as
        // "finished" would misread as a fast healthy pass.
        if (!controller.signal.aborted && !isStale() && !isSuspended()) {
          logger.info(
            `index: pass finished in ${Math.round(clock.monotonicNow() - passStarted)}ms — read ${passWorked} of ${passTotal} files`,
          )
        }
        // Aborted counts as superseded at every step below: `stop()` aborts
        // without making `isStale()` true, and every caller that stops a pass
        // (`refresh`, `close`, a graph switch) either starts a replacement pass
        // or tears the lifecycle down. Letting a stopped pass subscribe, start
        // the watcher, and reload every open note is churn the replacement pass
        // immediately undoes and redoes. The watcher itself is left running:
        // only `close` wants it stopped, and it stops the watcher itself.
        if (controller.signal.aborted || isStale() || isSuspended()) {
          return
        }
        emitApplied({ generation, paths: null })
        for (const listener of reconciledListeners) {
          void listener({ generation, source: 'sync' })
        }
        pending = liveIndex.subscribe(
          generation,
          (changes) => emitApplied({ generation, paths: changes.map((change) => change.path) }),
          emitMoved,
          () => !controller.signal.aborted && !isStale() && !isSuspended(),
        )
        if (controller.signal.aborted || isStale() || isSuspended()) {
          return
        }
        await fileChanges.startWatcher()
        if (controller.signal.aborted || isStale() || isSuspended()) {
          return
        }
        live.unlisten?.()
        live.unlisten = pending
        pending = null // ownership transferred
        emitProgress('live')
      } catch (error) {
        reportError('sync', error)
        if (!isStale()) {
          emitProgress('idle')
        }
      } finally {
        pending?.()
      }
    })()
  }

  let refreshRunning = false
  let refreshQueued = false

  function refresh(generation: number, isStale: () => boolean): void {
    if (isSuspended()) {
      return
    }
    if (refreshRunning) {
      refreshQueued = true
      return
    }
    refreshRunning = true
    void (async () => {
      try {
        do {
          refreshQueued = false
          // Settle (abort) any in-flight pass first so two passes never write
          // concurrently, then bail if a newer open superseded this graph.
          await stop()
          if (isStale() || isSuspended()) {
            return
          }
          sync(generation, isStale)
          await settled()
        } while (refreshQueued)
      } finally {
        refreshRunning = false
      }
    })()
  }

  let rebuildInFlight: { generation: number; promise: Promise<void> } | null = null

  async function runRebuild(generation: number): Promise<void> {
    const operation = operations.start('Rebuilding search index')
    const skippedNotes: string[] = []
    try {
      await indexer.rebuild({
        generation,
        onSkippedNote: (note) => {
          // The status toast lingers only briefly and samples the first few, so
          // log every skip in full — this is the durable record of which notes
          // fell out of the index and why.
          logger.warn(`Index rebuild skipped ${note.path}: ${note.message}`)
          skippedNotes.push(`${note.path}: ${note.message}`)
        },
      })
      if (skippedNotes.length === 0) {
        operation.done()
      } else {
        const sample = skippedNotes.slice(0, 3).join('; ')
        const suffix = skippedNotes.length > 3 ? `; +${skippedNotes.length - 3} more` : ''
        operation.warn(`Rebuilt with ${skippedNotes.length} skipped note(s): ${sample}${suffix}`)
      }
    } catch (cause) {
      operation.fail(errorMessage(cause))
      return
    }
    // A manual rebuild bypasses the watcher pipeline, and `index_clear` wiped
    // the embedding tables with everything else: followers refresh their
    // caches and re-embed off this, one after another.
    for (const listener of reconciledListeners) {
      await listener({ generation, source: 'rebuild' })
    }
  }

  function rebuildVisibly(generation: number): Promise<void> {
    if (rebuildInFlight !== null && rebuildInFlight.generation === generation) {
      return rebuildInFlight.promise
    }
    const promise = runRebuild(generation).finally(() => {
      if (rebuildInFlight !== null && rebuildInFlight.promise === promise) {
        rebuildInFlight = null
      }
    })
    rebuildInFlight = { generation, promise }
    return promise
  }

  return {
    open,
    sync,
    refresh,
    stop,
    settled,
    close,
    suspend,
    resume,
    setSuspendGuard: (shouldSuspend) => {
      suspendGuard = shouldSuspend
    },
    onProgress: (listener) => attach(progressListeners, listener),
    onApplied: (listener) => attach(appliedListeners, listener),
    applyChanges: async (changes, generation, canApply) => {
      const mutations = await liveIndex.apply(changes, generation, undefined, undefined, canApply)
      if (mutations > 0) {
        emitApplied({
          generation,
          paths: changes.filter((change) => isNotePath(change.path)).map((change) => change.path),
        })
      }
      return mutations
    },
    onChangesApplied: (listener) => attach(changesAppliedListeners, listener),
    onReconciled: (listener) => attach(reconciledListeners, listener),
    onMoved: (listener) => attach(movedListeners, listener),
    onFileProgress: (listener) => attach(fileProgressListeners, listener),
    onStalePlaceholders: (listener) => attach(stalePlaceholderListeners, listener),
    fileProgress: () => currentFileProgress,
    subscribeFileProgress: (listener) => attach(fileProgressStoreListeners, listener),
    rebuildVisibly,
    indexNote: async (path, options) => {
      await indexer.indexNote(path, options)
    },
    reindexNotesReferencing: async (assetPaths, generation) => {
      await indexer.reindexNotesReferencing(assetPaths, generation)
    },
  }
}

let installedService: IndexLifecycleService | null = null
let fallback: {
  service: IndexLifecycleService
  deps: IndexLifecycleDeps
  bridge: IpcBridge | null
} | null = null

function sameDeps(left: IndexLifecycleDeps, right: IndexLifecycleDeps): boolean {
  return (
    left.indexStore === right.indexStore &&
    left.noteFile === right.noteFile &&
    left.indexQuery === right.indexQuery &&
    left.database === right.database &&
    left.xArchive === right.xArchive &&
    left.hash === right.hash &&
    left.clock === right.clock &&
    left.logger === right.logger &&
    left.fileChanges === right.fileChanges &&
    left.operations === right.operations
  )
}

/**
 * The process-wide `IndexLifecycleService`; one over the default services
 * unless {@link setDefaultIndexLifecycle} installed another. The fallback is
 * rebuilt, with fresh state, when the bridge or a default service it runs on
 * is replaced.
 */
export function defaultIndexLifecycle(): IndexLifecycleService {
  if (installedService !== null) {
    return installedService
  }
  const deps: IndexLifecycleDeps = {
    ...defaultIndexingDeps(),
    fileChanges: defaultFileChanges(),
    operations: defaultOperations(),
  }
  const bridge = hasBridge() ? getBridge() : null
  if (fallback === null || fallback.bridge !== bridge || !sameDeps(fallback.deps, deps)) {
    fallback = { service: createIndexLifecycleService(deps), deps, bridge }
  }
  return fallback.service
}

/** Install the process-wide `IndexLifecycleService`; `null` restores the one over the default services. */
export function setDefaultIndexLifecycle(service: IndexLifecycleService | null): void {
  installedService = service
}
