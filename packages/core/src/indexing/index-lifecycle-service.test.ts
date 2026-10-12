import { afterEach, describe, expect, it, vi } from 'vitest'
import { setBridge } from '../ipc/bridge.ts'
import { createTestXArchiveService } from '../testing/capture.ts'
import { createTestClockService } from '../testing/clock.ts'
import { createTestDatabaseService, seedNotes, type TestNote } from '../testing/database.ts'
import { createTestFileChangeService } from '../testing/file-change.ts'
import { createTestNoteFileService } from '../testing/graph.ts'
import { createTestHashService } from '../testing/id.ts'
import { createTestIndexLifecycleService } from '../testing/index-lifecycle.ts'
import {
  createTestIndexStoreService,
  type IndexStoreCall,
  type TestIndexStoreServiceOptions,
} from '../testing/index-store.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestOperationsService } from '../testing/operations.ts'
import {
  createIndexLifecycleService,
  defaultIndexLifecycle,
  setDefaultIndexLifecycle,
  type IndexAppliedEvent,
  type IndexChangesAppliedEvent,
  type IndexLifecycleProgress,
  type IndexReconciledEvent,
} from './index-lifecycle-service.ts'
import { createIndexQueryService } from './index-query-service.ts'
import { PROJECTION_VERSION } from './indexed-note.ts'
import { PROJECTION_VERSION_KEY } from './indexer.ts'

const databases: { close(): void }[] = []

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close()
  }
})

/**
 * A lifecycle over test doubles, with every event recorded. The index is
 * stamped with the current projection version, so a sync pass is one
 * reconcile scan (`scan` in `steps`). The hooks run inside the matching call
 * of the pass: `onScan` may hold or reject the reconcile, `onSubscribe` runs
 * as the live subscription attaches, `onWatchStart` as the watcher starts.
 */
function setup(options?: {
  files?: Readonly<Record<string, string>>
  indexed?: readonly TestNote[]
  store?: TestIndexStoreServiceOptions
  failStore?: (call: IndexStoreCall) => unknown
  onScan?: () => Promise<void>
  onClear?: () => Promise<void>
  onSubscribe?: () => void
  onWatchStart?: () => void
  onRead?: () => void
}) {
  const database = createTestDatabaseService()
  databases.push(database)
  seedNotes(database, options?.indexed ?? [])
  const steps: string[] = []
  const store = createTestIndexStoreService({
    meta: { [PROJECTION_VERSION_KEY]: String(PROJECTION_VERSION) },
    ...options?.store,
    ...(options?.failStore ? { fail: options.failStore } : {}),
  })
  const files = createTestNoteFileService({ files: options?.files ?? {} })
  const fileChanges = createTestFileChangeService()
  const logger = createTestLoggerService()
  const clock = createTestClockService()
  const operations = createTestOperationsService(clock)
  const index = createIndexLifecycleService({
    indexStore: {
      ...store,
      reconcileScan: async (generation) => {
        steps.push('scan')
        await options?.onScan?.()
        return await store.reconcileScan(generation)
      },
      clear: async (generation) => {
        steps.push('clear')
        await options?.onClear?.()
        await store.clear(generation)
      },
    },
    noteFile: {
      ...files,
      read: async (path, generation) => {
        options?.onRead?.()
        return await files.read(path, generation)
      },
    },
    fileChanges: {
      ...fileChanges,
      subscribe: (listener) => {
        steps.push('subscribe')
        const unlisten = fileChanges.subscribe(listener)
        options?.onSubscribe?.()
        return unlisten
      },
      startWatcher: async () => {
        steps.push('watchStart')
        options?.onWatchStart?.()
        await fileChanges.startWatcher()
      },
      stopWatcher: async () => {
        steps.push('watchStop')
        await fileChanges.stopWatcher()
      },
    },
    indexQuery: createIndexQueryService({ database }),
    database,
    xArchive: createTestXArchiveService(),
    hash: createTestHashService(),
    clock,
    logger,
    operations,
  })
  const progress: IndexLifecycleProgress[] = []
  const applied: IndexAppliedEvent[] = []
  const reconciled: IndexReconciledEvent[] = []
  const moved: Array<[string, string]> = []
  const fileProgress: Array<[number, number, number]> = []
  const stalePlaceholders: string[][] = []
  const order: string[] = []
  index.onProgress((stage) => {
    progress.push(stage)
  })
  index.onApplied((event) => {
    applied.push(event)
    order.push('applied')
  })
  index.onReconciled((event) => {
    reconciled.push(event)
    order.push('reconciled')
  })
  index.onMoved((from, to) => {
    moved.push([from, to])
  })
  index.onFileProgress((done, total, worked) => {
    fileProgress.push([done, total, worked])
  })
  index.onStalePlaceholders((paths) => {
    stalePlaceholders.push([...paths])
  })
  return {
    index,
    store,
    files,
    fileChanges,
    logger,
    operations,
    steps,
    progress,
    applied,
    reconciled,
    moved,
    fileProgress,
    stalePlaceholders,
    order,
    /** How many sync passes reached their reconcile. */
    passes: () => steps.filter((step) => step === 'scan').length,
    /** Live subscriptions currently attached to the change stream. */
    subscriptions: () => fileChanges.listenerCount().changes,
  }
}

/** Sync passes that each stay in flight until their entry in `settles` is called. */
function heldScans() {
  const settles: Array<() => void> = []
  return {
    settles,
    onScan: () =>
      new Promise<void>((resolve) => {
        settles.push(resolve)
      }),
  }
}

describe('createIndexLifecycleService', () => {
  it('open() returns the generation from the index store', async () => {
    const { index } = setup({ store: { generation: 3 } })
    expect(await index.open()).toBe(3)
  })

  it('open() returns null and logs the failure (editing is never blocked)', async () => {
    const { index, logger } = setup({
      failStore: (call) => (call.method === 'open' ? new Error('boom') : undefined),
    })
    expect(await index.open()).toBeNull()
    expect(logger.getErrors()).toEqual([{ message: 'index open failed:', cause: 'boom' }])
  })

  it('close() stops the watcher and does not reconcile', async () => {
    const { index, steps } = setup()
    await index.close()
    expect(steps).toEqual(['watchStop'])
  })

  it('sync(generation) reconciles, then subscribes, then starts the watcher', async () => {
    const { index, store, fileChanges, steps, applied, subscriptions } = setup()
    index.sync(5, () => false)
    await index.settled() // settle without aborting: `stop()` skips the tail

    expect(store.calls()).toContainEqual({ method: 'reconcileScan', generation: 5 })
    // Sequenced: reconcile → subscribe → watchStart.
    expect(steps).toEqual(['scan', 'subscribe', 'watchStart'])
    // The initial reconcile is itself an index change: invalidate once there.
    expect(applied).toEqual([{ generation: 5, paths: null }])
    expect(fileChanges.watcherRunning()).toBe(true)
    expect(subscriptions()).toBe(1) // retained as the active subscription
  })

  it('reports each applied watcher batch with its paths and generation', async () => {
    const { index, fileChanges, applied } = setup({ files: { 'notes/a.md': '# A' } })
    index.sync(5, () => false)
    await index.settled()

    fileChanges.emit({ changes: [{ path: 'notes/a.md', kind: 'upsert' }], source: 'external' })

    await vi.waitFor(() => expect(applied).toHaveLength(2))
    expect(applied[1]).toEqual({ generation: 5, paths: ['notes/a.md'] })
  })

  it('reports the full batch of each applied watcher batch, asset files included', async () => {
    const { index, fileChanges } = setup({ files: { 'notes/a.md': '# A' } })
    const batches: IndexChangesAppliedEvent[] = []
    const unlisten = index.onChangesApplied((event) => {
      batches.push(event)
    })
    index.sync(5, () => false)
    await index.settled()
    expect(batches).toEqual([]) // a sync pass reports no batch

    const changes = [
      { path: 'notes/a.md', kind: 'upsert' as const },
      { path: 'notes/gone.md', kind: 'remove' as const },
      { path: 'assets/photo.png', kind: 'upsert' as const },
    ]
    fileChanges.emit({ changes, source: 'external' })
    await vi.waitFor(() => expect(batches).toHaveLength(1))
    expect(batches[0]).toEqual({ generation: 5, changes })

    unlisten()
    fileChanges.emit({ changes, source: 'external' })
    await index.close()
    expect(batches).toHaveLength(1)
  })

  it('reports the notes a description re-index applied, to its own listeners only', async () => {
    const REFERENCING = '# Hello\n\n![pic](assets/pic.png)\n'
    const { index } = setup({
      files: { 'notes/a.md': REFERENCING },
      indexed: [{ path: 'notes/a.md', markdown: REFERENCING }],
    })
    const other = setup()
    const batches: IndexChangesAppliedEvent[] = []
    const otherBatches: IndexChangesAppliedEvent[] = []
    index.onChangesApplied((event) => {
      batches.push(event)
    })
    other.index.onChangesApplied((event) => {
      otherBatches.push(event)
    })

    await index.reindexNotesReferencing(['assets/pic.png'], 7)

    expect(batches).toEqual([{ generation: 7, changes: [{ path: 'notes/a.md', kind: 'upsert' }] }])
    expect(otherBatches).toEqual([]) // the signal is per lifecycle, not process-wide
  })

  it('reports a move healed by the reconcile', async () => {
    const OLD = 'notes/01arz3ndektsv4rrffq69g5fav.md'
    const NEW = 'notes/meeting-notes.md'
    const content = '---\nid: 01abcdefghjkmnpqrstvwxyz00\n---\n# Meeting Notes\n'
    const { index, moved } = setup({
      files: { [NEW]: content },
      indexed: [{ path: OLD, markdown: content }],
      store: {
        scan: {
          total: 1,
          candidates: [{ path: NEW, modifiedMs: 9, storedMtime: null, storedHash: null }],
          orphans: [{ path: OLD, storedMtime: 1, storedHash: 'stored' }],
          stalePlaceholders: [],
        },
      },
    })
    index.sync(5, () => false)
    await index.settled()
    expect(moved).toEqual([[OLD, NEW]])
  })

  it('reports a completed pass via onReconciled, after onApplied', async () => {
    // The pass reads changed files into the index without emitting per-file
    // events; open note sessions re-read off this event.
    const { index, order, reconciled } = setup()
    index.sync(5, () => false)
    await index.settled() // settle without aborting: `stop()` would suppress it
    expect(order).toEqual(['applied', 'reconciled'])
    expect(reconciled).toEqual([{ generation: 5, source: 'sync' }])
  })

  it('logs a completed pass with its read counters', async () => {
    const { index, logger } = setup()
    index.sync(5, () => false)
    await index.settled()
    expect(logger.getInfos().map((entry) => entry.message)).toEqual([
      'index: pass finished in 0ms — read 0 of 0 files',
    ])
  })

  it('a superseded or failed pass never fires onReconciled', async () => {
    let fail = false
    const { index, reconciled } = setup({
      failStore: (call) =>
        fail && call.method === 'reconcileScan' ? new Error('boom') : undefined,
    })
    index.sync(5, () => true) // stale right after the reconcile
    await index.settled()
    expect(reconciled).toEqual([])

    fail = true
    index.sync(5, () => false)
    await index.settled()
    expect(reconciled).toEqual([])
  })

  it('an aborted pass runs no tail: no events, no subscribe, no watcher', async () => {
    // `stop()` aborts without making `isStale()` true, so an interrupted pass
    // bails on its own signal. Whoever stopped it either starts a replacement
    // pass (`refresh`, a graph switch) or tears the lifecycle down (`close`),
    // so a tail here is only undone and redone moments later.
    const { index, steps, applied, reconciled, logger } = setup()
    index.sync(5, () => false)
    await index.stop()
    expect(applied).toEqual([])
    expect(reconciled).toEqual([])
    expect(steps).not.toContain('subscribe')
    expect(steps).not.toContain('watchStart')
    expect(logger.getInfos()).toEqual([])
  })

  it('reports progress: reconciling → live; idle when closed', async () => {
    const { index, progress } = setup()
    index.sync(5, () => false)
    await index.settled()
    expect(progress).toEqual(['reconciling', 'live'])

    await index.close()
    expect(progress).toEqual(['reconciling', 'live', 'idle'])
  })

  it('reports idle (not live) when the sync pass fails un-superseded', async () => {
    const { index, progress } = setup({
      failStore: (call) => (call.method === 'reconcileScan' ? new Error('boom') : undefined),
    })
    index.sync(5, () => false)
    await index.stop()
    expect(progress).toEqual(['reconciling', 'idle'])
  })

  it('bails after reconcile when superseded — no subscribe, no watcher', async () => {
    const { index, steps } = setup()
    index.sync(5, () => true) // stale immediately after reconcile
    await index.settled()
    expect(steps).toEqual(['scan'])
  })

  it('tears down a subscription created after supersession (no listener leak)', async () => {
    let stale = false
    // Fresh through the reconcile, stale by the time the subscription exists.
    const { index, steps, subscriptions } = setup({
      onSubscribe: () => {
        stale = true
      },
    })
    index.sync(5, () => stale)
    await index.settled()
    expect(steps).toEqual(['scan', 'subscribe'])
    expect(subscriptions()).toBe(0) // pending subscription cleaned up
  })

  it('an abort during the subscribe drops the pending subscription', async () => {
    const harness = setup({
      onSubscribe: () => {
        void harness.index.stop()
      },
    })
    harness.index.sync(5, () => false)
    await harness.index.settled()
    expect(harness.steps).toEqual(['scan', 'subscribe'])
    expect(harness.subscriptions()).toBe(0) // pending subscription cleaned up
  })

  it('an abort during the watcher start leaves the subscription unadopted', async () => {
    const harness = setup({
      onWatchStart: () => {
        void harness.index.stop()
      },
    })
    harness.index.sync(5, () => false)
    await harness.index.settled()
    // Dropped rather than adopted, and the pass never claims to be live. The
    // watcher stays up for the replacement pass; only `close` stops it.
    expect(harness.subscriptions()).toBe(0)
    expect(harness.fileChanges.watcherRunning()).toBe(true)
    expect(harness.progress).toEqual(['reconciling'])
  })

  it('logs a sync failure but stop() still settles', async () => {
    const { index, logger } = setup({
      failStore: (call) =>
        call.method === 'reconcileScan' ? new Error('reconcile boom') : undefined,
    })
    index.sync(5, () => false)
    await index.stop()
    expect(logger.getErrors()).toEqual([{ message: 'index sync failed:', cause: 'reconcile boom' }])
  })

  it('stop() aborts the running reconcile and waits for it to settle', async () => {
    const held = heldScans()
    const { index, steps } = setup({ onScan: held.onScan })
    index.sync(5, () => false)
    await vi.waitFor(() => expect(held.settles).toHaveLength(1))

    let stopped = false
    const stopping = index.stop().then(() => {
      stopped = true
    })
    await Promise.resolve()
    expect(stopped).toBe(false) // still waiting on the pass

    held.settles[0]!()
    await stopping
    // Aborted before the reconcile returned: the pass wrote nothing further.
    expect(steps).toEqual(['scan'])
  })

  it('stop() before any sync resolves immediately', async () => {
    await expect(setup().index.stop()).resolves.toBeUndefined()
  })

  it('close() drops an active subscription', async () => {
    const { index, fileChanges, subscriptions } = setup()
    index.sync(5, () => false)
    await index.settled()
    expect(subscriptions()).toBe(1)

    await index.close()

    expect(subscriptions()).toBe(0)
    expect(fileChanges.watcherRunning()).toBe(false)
  })

  it('sync() drops the previous live subscription before the next pass', async () => {
    const { index, subscriptions } = setup()
    index.sync(5, () => false)
    await index.settled()

    index.sync(6, () => true)
    expect(subscriptions()).toBe(0)
    await index.settled()
  })

  it('refresh() coalesces stacked triggers into a single queued rerun', async () => {
    // Resume, poll-end, and watch-failed can fire together; each used to
    // abort the in-flight pass and start another — a full pass per trigger.
    const held = heldScans()
    const { index, passes } = setup({ onScan: held.onScan })

    index.refresh(5, () => false)
    await vi.waitFor(() => expect(held.settles).toHaveLength(1))
    index.refresh(5, () => false)
    index.refresh(5, () => false)
    index.refresh(5, () => false)

    held.settles[0]!()
    // The three stacked triggers fold into exactly one rerun…
    await vi.waitFor(() => expect(held.settles).toHaveLength(2))
    held.settles[1]!()
    // …and nothing further runs once the queue drains.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(passes()).toBe(2)
  })

  it('refresh() bails without a rerun when superseded', async () => {
    const { index, passes } = setup()
    index.refresh(5, () => true) // a newer open owns the lifecycle
    await index.settled()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(passes()).toBe(0)
  })

  it('defers an initial sync while the suspend guard holds and replays it on resume', async () => {
    let backgrounded = true
    const { index, steps, passes } = setup()
    index.setSuspendGuard(() => backgrounded)

    index.sync(5, () => false)
    await Promise.resolve()
    expect(steps).toEqual([])

    backgrounded = false
    index.resume(5, () => false)
    await vi.waitFor(() => expect(passes()).toBe(1))
    await index.settled()

    expect(steps).toEqual(['scan', 'subscribe', 'watchStart'])
  })

  it('resume(null) clears suspension without starting work before graph open', async () => {
    const { index, steps, passes } = setup()
    index.suspend()

    index.resume(null, () => false)
    await Promise.resolve()
    expect(passes()).toBe(0)

    index.sync(5, () => false)
    await index.settled()
    expect(steps).toEqual(['scan', 'subscribe', 'watchStart'])
  })

  it('suspend() aborts bulk work, drops live work, and resume coalesces catch-up triggers', async () => {
    const settles: Array<() => void> = []
    let hold = false
    const { index, store, files, fileChanges, passes, subscriptions, progress } = setup({
      files: { 'notes/a.md': '# A' },
      onScan: async () => {
        if (hold) {
          await new Promise<void>((resolve) => {
            settles.push(resolve)
          })
        }
      },
    })
    index.sync(5, () => false)
    await index.settled()
    expect(subscriptions()).toBe(1)

    index.suspend()
    expect(subscriptions()).toBe(0)
    expect(progress.at(-1)).toBe('idle')
    // A batch that arrives while suspended is not applied.
    files.set('notes/a.md', '# A, edited')
    fileChanges.emit({ changes: [{ path: 'notes/a.md', kind: 'upsert' }], source: 'external' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.applied()).toEqual([])

    hold = true
    index.resume(5, () => false)
    await vi.waitFor(() => expect(settles).toHaveLength(1))
    index.refresh(5, () => false)
    index.refresh(5, () => false)

    settles[0]!()
    await vi.waitFor(() => expect(settles).toHaveLength(2))
    settles[1]!()
    await new Promise((resolve) => setTimeout(resolve, 0))
    // One foreground catch-up plus one coalesced queued rerun, not one pass
    // for every simultaneous resume/iCloud trigger.
    expect(passes()).toBe(3)
  })

  it('reports stale placeholders of the running pass only', async () => {
    const scan = {
      total: 1,
      candidates: [],
      orphans: [],
      stalePlaceholders: ['notes/evicted.md'],
    }
    const current = setup({ store: { scan } })
    current.index.sync(5, () => false)
    await current.index.settled()
    expect(current.stalePlaceholders).toEqual([['notes/evicted.md']])

    // Opening a graph swaps the root before the old pass is stopped: a
    // superseded pass must not request its old paths against the new graph.
    const superseded = setup({ store: { scan } })
    superseded.index.sync(5, () => true)
    await superseded.index.settled()
    expect(superseded.stalePlaceholders).toEqual([])
  })
})

describe('file progress', () => {
  /** 32 changed candidates: the reconcile reports at file 16 and at the end. */
  function setupLargePass(onRead?: () => void) {
    const paths = Array.from({ length: 32 }, (_, position) => `notes/n${position}.md`)
    return setup({
      files: Object.fromEntries(paths.map((path) => [path, `# ${path}`])),
      ...(onRead ? { onRead } : {}),
      store: {
        scan: {
          total: 32,
          candidates: paths.map((path) => ({
            path,
            modifiedMs: 2_000,
            storedMtime: 1_000,
            storedHash: 'old',
          })),
          orphans: [],
          stalePlaceholders: [],
        },
      },
    })
  }

  it('publishes the running pass and clears once it goes live', async () => {
    const { index, fileProgress } = setupLargePass()
    const seen: Array<ReturnType<typeof index.fileProgress>> = []
    const unsubscribe = index.subscribeFileProgress(() => {
      seen.push(index.fileProgress())
    })
    expect(index.fileProgress()).toBeNull()

    index.sync(5, () => false)
    await index.settled()

    expect(fileProgress).toEqual([
      [16, 32, 15],
      [32, 32, 31],
      [32, 32, 32],
    ])
    expect(seen).toEqual([
      { done: 16, total: 32, worked: 15 },
      { done: 32, total: 32, worked: 31 },
      { done: 32, total: 32, worked: 32 },
      null, // the pass went live: the pill clears
    ])

    unsubscribe()
    index.suspend()
    expect(seen).toHaveLength(4) // already clear, and no longer listening
  })

  it('stops reporting file progress once the pass is superseded', async () => {
    let reads = 0
    let stale = false
    const { index, fileProgress } = setupLargePass(() => {
      reads += 1
      if (reads === 20) {
        stale = true // a superseded pass must go quiet
      }
    })
    index.sync(5, () => stale)
    await index.settled()

    expect(fileProgress).toEqual([[16, 32, 15]])
  })

  it('a test lifecycle seeds file progress for its subscribers', () => {
    const index = createTestIndexLifecycleService()
    const listener = vi.fn()
    const unsubscribe = index.subscribeFileProgress(listener)

    index.setFileProgress({ done: 16, total: 3000, worked: 16 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(index.fileProgress()).toEqual({ done: 16, total: 3000, worked: 16 })

    index.setFileProgress(null)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(index.fileProgress()).toBeNull()

    unsubscribe()
    index.setFileProgress({ done: 1, total: 200, worked: 1 })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('rebuildVisibly', () => {
  function heldClears() {
    const settles: Array<() => void> = []
    return {
      settles,
      onClear: () =>
        new Promise<void>((resolve) => {
          settles.push(resolve)
        }),
    }
  }

  function clears(steps: readonly string[]): number {
    return steps.filter((step) => step === 'clear').length
  }

  it('rebuilds at the generation and reports as an operation', async () => {
    const { index, store, operations, reconciled } = setup({ files: { 'notes/a.md': '# A' } })

    await index.rebuildVisibly(7)

    expect(store.calls().map((call) => call.method)).toEqual(['clear', 'applyBatch', 'setMeta'])
    expect(store.calls()[0]).toEqual({ method: 'clear', generation: 7 })
    expect(operations.findByLabel('Rebuilding search index')?.status).toBe('running')
    expect(reconciled).toEqual([{ generation: 7, source: 'rebuild' }])
  })

  it('coalesces concurrent requests at the same generation onto one pass', async () => {
    const held = heldClears()
    const { index, steps } = setup({ onClear: held.onClear })

    const first = index.rebuildVisibly(7)
    const second = index.rebuildVisibly(7)

    expect(second).toBe(first)
    expect(clears(steps)).toBe(1)

    held.settles[0]!()
    await first

    // Once settled, the guard is released and the next request rebuilds again.
    const third = index.rebuildVisibly(7)
    await vi.waitFor(() => expect(held.settles).toHaveLength(2))
    held.settles[1]!()
    await third
    expect(clears(steps)).toBe(2)
  })

  it('starts a fresh pass for a different generation', async () => {
    const held = heldClears()
    const { index, store, steps } = setup({ onClear: held.onClear })

    const first = index.rebuildVisibly(7)
    const second = index.rebuildVisibly(8)
    expect(second).not.toBe(first)
    await vi.waitFor(() => expect(held.settles).toHaveLength(2))

    expect(clears(steps)).toBe(2)
    held.settles[1]!()
    await second
    expect(store.calls()).toContainEqual({ method: 'clear', generation: 8 })

    held.settles[0]!()
    await first
  })

  it('stays in flight until the followers of the rebuild settle', async () => {
    const follower = Promise.withResolvers<void>()
    const { index, steps } = setup()
    index.onReconciled(async ({ source }) => {
      if (source === 'rebuild') {
        await follower.promise
      }
    })

    const first = index.rebuildVisibly(7)
    await vi.waitFor(() => expect(steps).toContain('clear'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    // The wipe and the re-index are done, the follower (a re-embed) is not:
    // a second request still joins the same pass.
    expect(index.rebuildVisibly(7)).toBe(first)

    follower.resolve()
    await first
    expect(clears(steps)).toBe(1)
  })

  it('warns with a sample when a rebuild reports skipped notes', async () => {
    const { index, operations, logger, reconciled } = setup({
      files: { 'notes/bad.md': '# bad' },
      failStore: (call) =>
        call.method === 'applyBatch'
          ? { kind: 'parse', message: 'unexpected end of hex escape' }
          : undefined,
    })

    await expect(index.rebuildVisibly(7)).resolves.toBeUndefined()

    expect(logger.getWarnings().map((entry) => entry.message)).toEqual([
      'Index rebuild skipped notes/bad.md: unexpected end of hex escape',
    ])
    expect(operations.snapshot()).toMatchObject([
      {
        label: 'Rebuilding search index',
        status: 'warning',
        message: 'Rebuilt with 1 skipped note(s): notes/bad.md: unexpected end of hex escape',
      },
    ])
    expect(reconciled).toEqual([{ generation: 7, source: 'rebuild' }])
  })

  it('absorbs a failed rebuild, reports nothing, and releases the in-flight guard', async () => {
    let fail = true
    const { index, operations, reconciled, steps } = setup({
      failStore: (call) =>
        fail && call.method === 'clear' ? new Error('index on fire') : undefined,
    })

    await expect(index.rebuildVisibly(7)).resolves.toBeUndefined()
    expect(operations.snapshot()).toMatchObject([{ status: 'failed', message: 'index on fire' }])
    expect(reconciled).toEqual([])

    fail = false
    await index.rebuildVisibly(7)
    expect(clears(steps)).toBe(2)
    expect(reconciled).toEqual([{ generation: 7, source: 'rebuild' }])
  })

  it('a test lifecycle records the requested generations', async () => {
    const index = createTestIndexLifecycleService()
    await index.rebuildVisibly(7)
    expect(index.rebuilds()).toEqual([7])
  })
})

describe('applyChanges', () => {
  it('applies the changed notes without a live subscription and reports them', async () => {
    const { index, store, applied, steps } = setup({
      files: { 'notes/pulled.md': '# Pulled\n' },
    })

    const mutations = await index.applyChanges(
      [
        { path: 'notes/pulled.md', kind: 'upsert', modifiedMs: 5 },
        { path: 'audio-memos/memo.m4a', kind: 'upsert', modifiedMs: 6 },
      ],
      4,
    )

    expect(mutations).toBe(1)
    expect(store.applied().map((note) => note.path)).toEqual(['notes/pulled.md'])
    expect(applied).toEqual([{ generation: 4, paths: ['notes/pulled.md'] }])
    expect(steps).not.toContain('subscribe')
  })

  it('reports nothing when no index row changed', async () => {
    const { index, applied } = setup()

    expect(await index.applyChanges([{ path: 'assets/a.png', kind: 'upsert' }], 4)).toBe(0)
    expect(applied).toEqual([])
  })

  it('writes nothing while `canApply` says no', async () => {
    const { index, store, applied } = setup({ files: { 'notes/pulled.md': '# Pulled\n' } })

    const mutations = await index.applyChanges(
      [{ path: 'notes/pulled.md', kind: 'upsert', modifiedMs: 5 }],
      4,
      () => false,
    )

    expect(mutations).toBe(0)
    expect(store.applied()).toEqual([])
    expect(applied).toEqual([])
  })
})

describe('defaultIndexLifecycle', () => {
  afterEach(() => {
    setDefaultIndexLifecycle(null)
    setBridge(null)
  })

  it('keeps one lifecycle until the bridge is replaced', () => {
    const first = defaultIndexLifecycle()
    expect(defaultIndexLifecycle()).toBe(first)

    setBridge({ invoke: async () => null, listen: async () => () => {} })
    const second = defaultIndexLifecycle()
    expect(second).not.toBe(first)
    expect(defaultIndexLifecycle()).toBe(second)
  })

  it('returns an installed lifecycle', () => {
    const installed = createTestIndexLifecycleService()
    setDefaultIndexLifecycle(installed)
    expect(defaultIndexLifecycle()).toBe(installed)

    setDefaultIndexLifecycle(null)
    expect(defaultIndexLifecycle()).not.toBe(installed)
  })
})
