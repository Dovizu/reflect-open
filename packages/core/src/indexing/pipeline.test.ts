import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBridge } from '../ipc/bridge.ts'
import {
  createTestIndexStoreService,
  type IndexStoreCall,
  type TestIndexStoreService,
  type TestIndexStoreServiceOptions,
} from '../testing/index-store.ts'
import { getBacklinks, resolveWikiTarget } from './queries.ts'
import { hashContent } from './hash.ts'
import { PROJECTION_VERSION } from './indexed-note.ts'
import {
  indexNote,
  rebuildIndex,
  reconcileIndex,
  reindexNotesReferencing,
  syncIndex,
  PROJECTION_VERSION_KEY,
} from './indexer.ts'
import { subscribeIndexApplied } from './index-applied.ts'
import { setDefaultIndexStore } from './index-store-service.ts'
import { applyIndexChanges } from './live.ts'

// Index writes land in a test index store; note reads and Kysely queries still
// answer from a fake bridge.
const mockInvoke = vi.fn<(command: string, args: Record<string, unknown>) => Promise<unknown>>()
setBridge({ invoke: mockInvoke, listen: async () => () => {} })

/** Mirrors the default list_files: one arrival needing a read. */
const DEFAULT_SCAN = {
  total: 1,
  candidates: [{ path: 'notes/a.md', modifiedMs: 5, storedMtime: null, storedHash: null }],
  orphans: [],
  stalePlaceholders: [],
}

let store: TestIndexStoreService

function useStore(options?: TestIndexStoreServiceOptions): TestIndexStoreService {
  store = createTestIndexStoreService({ scan: DEFAULT_SCAN, ...options })
  setDefaultIndexStore(store)
  return store
}

function methods(): IndexStoreCall['method'][] {
  return store.calls().map((call) => call.method)
}

function findCall<Method extends IndexStoreCall['method']>(
  method: Method,
): Extract<IndexStoreCall, { method: Method }> | undefined {
  return store
    .calls()
    .find((call): call is Extract<IndexStoreCall, { method: Method }> => call.method === method)
}

afterEach(() => {
  setDefaultIndexStore(null)
})

beforeEach(() => {
  useStore()
  mockInvoke.mockReset()
  mockInvoke.mockImplementation(async (command, args) => {
    const sql = String(args['sql'] ?? '')
    switch (command) {
      case 'note_read':
        return '# Hello\n\n[[World]]'
      case 'list_files':
        return [{ path: 'notes/a.md', size: 1, modifiedMs: 5 }]
      case 'db_query':
        if (sql.includes('from "assets"')) return [{ note_path: 'notes/a.md' }]
        if (sql.includes('note_keys')) return [{ note_path: 'notes/a.md' }]
        if (sql.includes('backlinks')) {
          return [
            { source_path: 'notes/b.md', target_raw: 'A', alias: null, pos_from: 0, pos_to: 3 },
          ]
        }
        if (sql.includes('"notes"') && sql.includes('title_key')) {
          return [{ path: 'notes/a.md' }]
        }
        return []
      default:
        return null
    }
  })
})

describe('indexNote', () => {
  it('reads, parses, and applies a built index payload with its generation', async () => {
    await indexNote('notes/a.md', { generation: 7, mtime: 5 })
    const apply = findCall('apply')
    expect(apply).toBeDefined()
    expect(apply!.generation).toBe(7)
    expect(apply!.note.path).toBe('notes/a.md')
    expect(apply!.note.title).toBe('Hello')
    expect(apply!.note.mtime).toBe(5)
    expect(apply!.note.fileHash).toMatch(/^[0-9a-f]{64}$/)
    expect(apply!.note.links.map((link) => link.targetKey)).toContain('world')
  })
})

describe('reindexNotesReferencing', () => {
  it('re-applies referencing notes and emits the post-apply signal', async () => {
    const emitted: Array<[readonly { path: string; kind: string }[], number]> = []
    const unsubscribe = subscribeIndexApplied((changes, generation) => {
      emitted.push([changes, generation])
    })
    try {
      await reindexNotesReferencing(['assets/pic.png'], 7)
    } finally {
      unsubscribe()
    }

    const apply = findCall('apply')
    expect(apply).toBeDefined()
    expect(apply!.generation).toBe(7)

    // These writes bypass the watcher pipeline, so the emit is the only way
    // followers (the embedding sync) hear about the refreshed notes.
    expect(emitted).toEqual([[[{ path: 'notes/a.md', kind: 'upsert' }], 7]])
  })

  it('still emits the applied prefix when a later note’s re-index throws', async () => {
    mockInvoke.mockImplementation(async (command, args) => {
      const sql = String(args['sql'] ?? '')
      if (command === 'db_query' && sql.includes('from "assets"')) {
        return [{ note_path: 'notes/a.md' }, { note_path: 'notes/b.md' }]
      }
      if (command === 'note_read') {
        if ((args as { path: string }).path === 'notes/b.md') {
          throw { kind: 'io', message: 'disk error' }
        }
        return '# Hello'
      }
      return null
    })
    const emitted: Array<readonly { path: string }[]> = []
    const unsubscribe = subscribeIndexApplied((changes) => {
      emitted.push(changes)
    })
    try {
      await expect(reindexNotesReferencing(['assets/pic.png'], 7)).rejects.toMatchObject({
        kind: 'io',
      })
    } finally {
      unsubscribe()
    }
    // notes/a.md was applied before the failure — followers must hear it.
    expect(emitted).toEqual([[{ path: 'notes/a.md', kind: 'upsert' }]])
  })

  it('emits nothing when no note references the assets', async () => {
    mockInvoke.mockImplementation(async (command, args) => {
      const sql = String(args['sql'] ?? '')
      if (command === 'db_query' && sql.includes('from "assets"')) {
        return []
      }
      return null
    })
    const emitted: unknown[] = []
    const unsubscribe = subscribeIndexApplied((changes) => {
      emitted.push(changes)
    })
    try {
      await reindexNotesReferencing(['assets/pic.png'], 7)
    } finally {
      unsubscribe()
    }
    expect(emitted).toEqual([])
  })
})

describe('rebuildIndex', () => {
  it('clears, lists, applies every file in one batch, then stamps the projection version', async () => {
    const progress: Array<[number, number, number]> = []
    await rebuildIndex({
      generation: 1,
      onFileProgress: (done, total, worked) => {
        progress.push([done, total, worked])
      },
    })
    // A rebuild reads everything: worked tracks done, so the pill surfaces.
    expect(progress.at(-1)).toEqual([1, 1, 1])
    expect(methods()[0]).toBe('clear')
    expect(mockInvoke.mock.calls.map(([cmd]) => cmd)).toContain('list_files')
    const batch = findCall('applyBatch')
    expect(batch).toBeDefined()
    expect(batch!.notes.map((note) => note.path)).toEqual(['notes/a.md'])
    expect(methods()).not.toContain('apply') // batched, not one-by-one
    // The stamp lets the next open reconcile instead of rebuilding again.
    expect(findCall('setMeta')).toMatchObject({
      key: PROJECTION_VERSION_KEY,
      value: String(PROJECTION_VERSION),
      generation: 1,
    })
  })

  it('splits a failed rebuild batch and still applies the notes individually', async () => {
    useStore({
      fail: (call) =>
        call.method === 'applyBatch' && call.notes.length > 1
          ? new Error('batch payload refused')
          : undefined,
    })
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'list_files') {
        return [
          { path: 'notes/a.md', size: 1, modifiedMs: 1 },
          { path: 'notes/b.md', size: 1, modifiedMs: 2 },
          { path: 'notes/c.md', size: 1, modifiedMs: 3 },
        ]
      }
      if (command === 'note_read') {
        return `# ${String(args['path'])}\n`
      }
      return null
    })

    await rebuildIndex({ generation: 1 })

    const attempted = store
      .calls()
      .flatMap((call) =>
        call.method === 'applyBatch' ? [call.notes.map((note) => note.path)] : [],
      )
    expect(attempted).toEqual([
      ['notes/a.md', 'notes/b.md', 'notes/c.md'],
      ['notes/a.md', 'notes/b.md'],
      ['notes/a.md'],
      ['notes/b.md'],
      ['notes/c.md'],
    ])
    expect(store.applied().map((note) => note.path)).toEqual([
      'notes/a.md',
      'notes/b.md',
      'notes/c.md',
    ])
    expect(methods()).toContain('setMeta')
  })

  it('reports and skips a note whose projection cannot be written alone', async () => {
    useStore({
      fail: (call) =>
        call.method === 'applyBatch'
          ? { kind: 'parse', message: 'unexpected end of hex escape' }
          : undefined,
    })
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'list_files') {
        return [{ path: 'notes/bad.md', size: 1, modifiedMs: 1 }]
      }
      if (command === 'note_read') {
        return `# ${String(args['path'])}\n`
      }
      return null
    })
    const skipped: Array<{ path: string; message: string }> = []

    await rebuildIndex({
      generation: 1,
      onSkippedNote: (note) => {
        skipped.push(note)
      },
    })

    expect(skipped).toEqual([{ path: 'notes/bad.md', message: 'unexpected end of hex escape' }])
    expect(methods()).toContain('setMeta')
  })

  it('throws a single-note write failure when no skip callback is registered', async () => {
    useStore({
      fail: (call) => (call.method === 'applyBatch' ? new Error('single note refused') : undefined),
    })
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'list_files') {
        return [{ path: 'notes/bad.md', size: 1, modifiedMs: 1 }]
      }
      if (command === 'note_read') {
        return `# ${String(args['path'])}\n`
      }
      return null
    })

    await expect(rebuildIndex({ generation: 1 })).rejects.toThrow('single note refused')
    expect(methods()).not.toContain('setMeta')
  })

  it('stops before the next SQLite write when suspended after the rebuild wipe', async () => {
    const controller = new AbortController()
    mockInvoke.mockImplementation(async (command) => {
      if (command === 'list_files') {
        return [{ path: 'notes/a.md', size: 1, modifiedMs: 1 }]
      }
      if (command === 'note_read') {
        // Models iOS becoming hidden while filesystem work is in flight.
        controller.abort()
        return '# A\n'
      }
      return null
    })

    await rebuildIndex({ generation: 1, signal: controller.signal })

    expect(methods()).toContain('clear') // began while foregrounded
    expect(methods()).not.toContain('applyBatch')
    // No new projection stamp is written; foreground sync converges either by
    // rebuilding an old projection or reconciling missing rows for a current one.
    expect(methods()).not.toContain('setMeta')
  })
})

describe('syncIndex', () => {
  it('reconciles (no wipe) when the stored projection version is current', async () => {
    useStore({ meta: { [PROJECTION_VERSION_KEY]: String(PROJECTION_VERSION) } })
    await syncIndex({ generation: 2 })
    expect(methods()).toContain('reconcileScan')
    expect(methods()).not.toContain('clear')
    expect(methods()).not.toContain('setMeta')
  })

  it('rebuilds and stamps when the index predates the current projection', async () => {
    // never stamped (or written by an older app)
    await syncIndex({ generation: 3 })
    expect(methods()).toContain('clear')
    expect(findCall('setMeta')).toMatchObject({
      key: PROJECTION_VERSION_KEY,
      value: String(PROJECTION_VERSION),
      generation: 3,
    })
  })
})

describe('applyIndexChanges (watcher dispatch)', () => {
  it('re-indexes upserts (batched) and removes deletes at the given generation', async () => {
    const mutations = await applyIndexChanges(
      [
        { path: 'notes/a.md', kind: 'upsert', modifiedMs: 4242 },
        { path: 'notes/gone.md', kind: 'remove' },
      ],
      9,
    )
    const apply = findCall('applyBatch')
    expect(apply!.generation).toBe(9)
    expect(apply!.notes.map((note) => note.path)).toEqual(['notes/a.md'])
    expect(apply!.notes[0]!.mtime).toBe(4242)
    expect(findCall('remove')).toMatchObject({ path: 'notes/gone.md', generation: 9 })
    expect(mutations).toBe(2)
  })

  it('stamps "now" — never epoch zero — when an upsert carries no modifiedMs', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000)
    try {
      await applyIndexChanges([{ path: 'notes/a.md', kind: 'upsert' }], 9)
      expect(store.applied()[0]!.mtime).toBe(1_750_000_000_000)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('skips upserts whose indexed row already matches an old mtime, without reading', async () => {
    // The iCloud watch's initial gather re-reports every downloaded note; a
    // row indexed at the same (settled) mtime must cost neither a read nor a
    // write — and a zero-mutation batch reports 0 so no invalidation fires.
    mockInvoke.mockImplementation(async (command, args) => {
      const sql = String(args['sql'] ?? '')
      if (command === 'db_query' && sql.includes('file_hash')) {
        return [{ path: 'notes/a.md', file_hash: 'stored', mtime: 1_000 }]
      }
      if (command === 'db_query') {
        return []
      }
      if (command === 'note_read') {
        throw new Error('must not read an mtime-matched file')
      }
      return null
    })

    const mutations = await applyIndexChanges(
      [{ path: 'notes/a.md', kind: 'upsert', modifiedMs: 1_000 }],
      9,
    )

    expect(mutations).toBe(0)
    expect(mockInvoke.mock.calls.map(([cmd]) => cmd)).not.toContain('note_read')
    expect(methods()).not.toContain('applyBatch')
    expect(methods()).not.toContain('touch')
  })

  it('re-stamps the stored mtime when content is unchanged but the mtime moved', async () => {
    const content = '# same content\n'
    mockInvoke.mockImplementation(async (command, args) => {
      const sql = String(args['sql'] ?? '')
      if (command === 'db_query' && sql.includes('file_hash')) {
        return [{ path: 'notes/a.md', file_hash: await hashContent(content), mtime: 1_000 }]
      }
      if (command === 'db_query') {
        return []
      }
      if (command === 'note_read') {
        return content
      }
      return null
    })

    const mutations = await applyIndexChanges(
      [{ path: 'notes/a.md', kind: 'upsert', modifiedMs: 2_000 }],
      9,
    )

    // The re-stamp counts as a mutation: `updated_at` moved, so
    // recency-ordered queries must be invalidated.
    expect(mutations).toBe(1)
    expect(findCall('touch')).toEqual({
      method: 'touch',
      entries: [{ path: 'notes/a.md', mtime: 2_000 }],
      generation: 9,
    })
    expect(methods()).not.toContain('applyBatch')
  })

  it('still reads when the reported mtime is too fresh to trust', async () => {
    // Local write echoes stamp rows with Date.now(): two same-millisecond
    // saves would look "unchanged" by mtime alone, so fresh mtimes always
    // take the read-and-hash path.
    const now = 1_750_000_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
    try {
      mockInvoke.mockImplementation(async (command, args) => {
        const sql = String(args['sql'] ?? '')
        if (command === 'db_query' && sql.includes('file_hash')) {
          return [{ path: 'notes/a.md', file_hash: 'stale', mtime: now - 10 }]
        }
        if (command === 'db_query') {
          return []
        }
        if (command === 'note_read') {
          return '# fresh content'
        }
        return null
      })

      const mutations = await applyIndexChanges(
        [{ path: 'notes/a.md', kind: 'upsert', modifiedMs: now - 10 }],
        9,
      )

      expect(mutations).toBe(1)
      expect(mockInvoke.mock.calls.map(([cmd]) => cmd)).toContain('note_read')
      expect(methods()).toContain('applyBatch')
    } finally {
      nowSpy.mockRestore()
    }
  })
})

describe('Kysely → db_query bridge', () => {
  it('getBacklinks maps snake_case rows back to camelCase', async () => {
    const backlinks = await getBacklinks('notes/a.md')
    expect(backlinks).toEqual([
      { sourcePath: 'notes/b.md', targetRaw: 'A', alias: null, posFrom: 0, posTo: 3 },
    ])
  })

  it('resolveWikiTarget resolves a title match to a note ref', async () => {
    expect(await resolveWikiTarget('World')).toEqual({ kind: 'resolved', ref: 'notes/a.md' })
  })
})

describe('reconcileIndex move healing (Plan 17)', () => {
  const OLD = 'notes/01arz3ndektsv4rrffq69g5fav.md'
  const NEW = 'notes/meeting-notes.md'
  const CONTENT = '---\nid: 01abcdefghjkmnpqrstvwxyz00\n---\n# Meeting Notes\n'

  /** A graph where OLD's row remains but the file now lives at NEW. */
  function renameFake(options: { storedHash: string; content?: string }) {
    useStore({
      scan: {
        total: 1,
        candidates: [{ path: NEW, modifiedMs: 9, storedMtime: null, storedHash: null }],
        orphans: [{ path: OLD, storedMtime: 1, storedHash: options.storedHash }],
        stalePlaceholders: [],
      },
    })
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'note_read') {
        if (args['path'] === NEW) {
          return options.content ?? CONTENT
        }
        throw { kind: 'notFound', message: 'missing' }
      }
      if (command === 'db_query') {
        if (((args['params'] as unknown[]) ?? []).includes(OLD)) {
          return [{ path: OLD, id: '01abcdefghjkmnpqrstvwxyz00' }]
        }
        return []
      }
      return null
    })
  }

  it('moves the rows and skips the re-index when content is unchanged', async () => {
    renameFake({ storedHash: await hashContent(CONTENT) })

    await reconcileIndex({ generation: 4 })

    expect(findCall('move')).toEqual({ method: 'move', from: OLD, to: NEW, generation: 4 })
    // The moved row carried its hash: identical content means no re-apply —
    // and crucially no remove, so embeddings survived.
    expect(store.applied()).toEqual([])
    expect(store.removed()).toEqual([])
  })

  it('announces the heal via onMoved so the app can follow', async () => {
    renameFake({ storedHash: await hashContent(CONTENT) })
    const moves: Array<[string, string]> = []

    await reconcileIndex({
      generation: 4,
      onMoved: (from, to) => {
        moves.push([from, to])
      },
    })

    expect(moves).toEqual([[OLD, NEW]])
  })

  it('re-indexes at the new path when content changed in transit', async () => {
    renameFake({ storedHash: 'stale-hash-from-before-the-edit' })

    await reconcileIndex({ generation: 4 })

    expect(store.moved()).toEqual([{ from: OLD, to: NEW }])
    expect(store.removed()).toEqual([])
    expect(findCall('applyBatch')?.notes.map((note) => note.path)).toEqual([NEW])
  })

  it('a legacy file without an id still reconciles as delete+create', async () => {
    renameFake({
      storedHash: 'whatever',
      content: '# Meeting Notes\n',
    })

    await reconcileIndex({ generation: 4 })

    expect(store.moved()).toEqual([])
    expect(store.applied().map((note) => note.path)).toEqual([NEW])
    expect(store.removed()).toEqual([OLD])
  })
})

describe('reconcileIndex over the native scan delta', () => {
  it('does nothing when the scan reports no delta — the healthy-open path', async () => {
    // Mtime-matched files never leave Rust (the scan's own tests cover the
    // classification); an empty delta must cost no reads, no writes, and no
    // visible progress.
    useStore({ scan: { total: 7_000, candidates: [], orphans: [], stalePlaceholders: [] } })
    mockInvoke.mockImplementation(async (command) => {
      if (command === 'note_read') {
        throw new Error('must not read without a candidate')
      }
      if (command === 'db_query') {
        return []
      }
      return null
    })
    const progress: Array<[number, number, number]> = []

    await reconcileIndex({
      generation: 4,
      onFileProgress: (done, total, worked) => {
        progress.push([done, total, worked])
      },
    })

    expect(methods()).toEqual(['reconcileScan'])
    expect(mockInvoke).not.toHaveBeenCalled()
    // Zero worked files, and the total is the delta (0), not the graph size —
    // the pill stays hidden on every routine open.
    expect(progress).toEqual([[0, 0, 0]])
  })

  it('reads (and hash-skips) a candidate whose stored mtime differs — providers rewrite mtimes', async () => {
    const content = '# Hello\n'
    const storedHash = await hashContent(content)
    useStore({
      scan: {
        total: 1,
        candidates: [{ path: 'notes/a.md', modifiedMs: 2_000, storedMtime: 1_000, storedHash }],
        orphans: [],
        stalePlaceholders: [],
      },
    })
    mockInvoke.mockImplementation(async (command) => {
      if (command === 'note_read') {
        return content
      }
      if (command === 'db_query') {
        return []
      }
      return null
    })

    const progress: Array<[number, number, number]> = []

    await reconcileIndex({
      generation: 4,
      onFileProgress: (done, total, worked) => {
        progress.push([done, total, worked])
      },
    })

    expect(mockInvoke.mock.calls.map(([cmd]) => cmd)).toContain('note_read')
    // Identical content under a rewritten mtime: the hash still gates the write.
    expect(methods()).not.toContain('applyBatch')
    // The self-heal: the row is re-stamped with the listed mtime, so the next
    // scan skips it entirely instead of re-reading forever.
    expect(findCall('touch')).toEqual({
      method: 'touch',
      entries: [{ path: 'notes/a.md', mtime: 2_000 }],
      generation: 4,
    })
    // The read counts as worked even though nothing was re-applied.
    expect(progress.at(-1)).toEqual([1, 1, 1])
  })

  it('re-indexes changed candidates and drops orphans', async () => {
    useStore({
      scan: {
        total: 2,
        candidates: [
          { path: 'notes/changed.md', modifiedMs: 2_000, storedMtime: 1_000, storedHash: 'old' },
        ],
        orphans: [{ path: 'notes/gone.md', storedMtime: 1_000, storedHash: 'gone' }],
        stalePlaceholders: [],
      },
    })
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'note_read') {
        return `# ${String(args['path'])}\n`
      }
      if (command === 'db_query') {
        return []
      }
      return null
    })

    await reconcileIndex({ generation: 4 })

    const notes = store.applied()
    expect(notes.map((note) => note.path)).toEqual(['notes/changed.md'])
    expect(notes[0]!.mtime).toBe(2_000)
    expect(findCall('remove')).toMatchObject({ path: 'notes/gone.md', generation: 4 })
  })

  it('removes the row for a candidate that vanished between the scan and the read', async () => {
    useStore({
      scan: {
        total: 1,
        candidates: [
          { path: 'notes/ghost.md', modifiedMs: 2_000, storedMtime: 1_000, storedHash: 'h' },
        ],
        orphans: [],
        stalePlaceholders: [],
      },
    })
    mockInvoke.mockImplementation(async (command) => {
      if (command === 'note_read') {
        throw { kind: 'notFound', message: 'vanished' }
      }
      if (command === 'db_query') {
        return []
      }
      return null
    })

    await reconcileIndex({ generation: 4 })

    expect(findCall('remove')).toMatchObject({ path: 'notes/ghost.md', generation: 4 })
  })
})

describe('iCloud eviction placeholders (Plan 21)', () => {
  /** A graph whose listing carries `files`; every note_read throws notFound. */
  // Reconcile-side placeholder rules (never a candidate, never an orphan)
  // now live in the Rust scan — `reconcile_scan_classifies_candidates_orphans_and_skips`
  // in src-tauri covers them. Only the rebuild path still walks the listing here.
  it('rebuild indexes readable files and skips evicted ones', async () => {
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'list_files') {
        return [
          { path: 'notes/real.md', size: 1, modifiedMs: 5 },
          { path: 'notes/evicted.md', size: 1, modifiedMs: 5, placeholder: true },
        ]
      }
      if (command === 'note_read') {
        if (args['path'] === 'notes/real.md') {
          return '# Real\n'
        }
        throw { kind: 'notFound', message: 'evicted' }
      }
      return null
    })

    const stale: string[][] = []
    await rebuildIndex({
      generation: 6,
      onStalePlaceholders: (paths) => {
        stale.push([...paths])
      },
    })

    expect(store.applied().map((note) => note.path)).toEqual(['notes/real.md'])
    // The wipe dropped the evicted note's row and the rebuild couldn't read
    // it — it must be surfaced for a targeted download, or it silently
    // disappears from search until something else materializes it.
    expect(stale).toEqual([['notes/evicted.md']])
  })

  it('reconcile surfaces stale placeholders for targeted downloads', async () => {
    useStore({
      scan: {
        total: 3,
        candidates: [],
        orphans: [],
        stalePlaceholders: ['notes/remote-edit.md', 'notes/never-local.md'],
      },
    })
    mockInvoke.mockImplementation(async (command) => {
      if (command === 'db_query') {
        return []
      }
      return null
    })

    const stale: string[][] = []
    await reconcileIndex({
      generation: 4,
      onStalePlaceholders: (paths) => {
        stale.push([...paths])
      },
    })

    expect(stale).toEqual([['notes/remote-edit.md', 'notes/never-local.md']])
    // Placeholders are never read — that would force the very downloads the
    // callback exists to make targeted and non-blocking.
    expect(mockInvoke.mock.calls.map(([cmd]) => cmd)).not.toContain('note_read')
  })
})
