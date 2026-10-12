import type { IndexedNote } from '../indexing/indexed-note.ts'
import {
  createIndexApplyBatchWriter,
  createMtimeTouchBatchWriter,
  type IndexedNoteTouch,
  type IndexStoreService,
  type ReconcileScan,
} from '../indexing/index-store-service.ts'
import type { TestDatabaseService } from './database.ts'

/** One recorded {@link IndexStoreService} call. */
export type IndexStoreCall =
  | { readonly method: 'open' }
  | { readonly method: 'apply'; readonly note: IndexedNote; readonly generation: number }
  | {
      readonly method: 'applyBatch'
      readonly notes: readonly IndexedNote[]
      readonly generation: number
    }
  | { readonly method: 'remove'; readonly path: string; readonly generation: number }
  | {
      readonly method: 'move'
      readonly from: string
      readonly to: string
      readonly generation: number
    }
  | {
      readonly method: 'moveIndexed'
      readonly from: string
      readonly to: string
      readonly fileGeneration: number
    }
  | { readonly method: 'reconcileScan'; readonly generation: number }
  | {
      readonly method: 'touch'
      readonly entries: readonly IndexedNoteTouch[]
      readonly generation: number
    }
  | { readonly method: 'clear'; readonly generation: number }
  | { readonly method: 'getMeta'; readonly key: string }
  | {
      readonly method: 'setMeta'
      readonly key: string
      readonly value: string
      readonly generation: number
    }

export interface TestIndexStoreServiceOptions {
  /**
   * Mirror applies, removes, clears and `index_meta` into this database, so
   * reads through it see what the store wrote. Row moves are not mirrored.
   */
  database?: TestDatabaseService
  /** What `open` resolves with. Defaults to `1`. */
  generation?: number
  /** What `reconcileScan` resolves with. Defaults to an empty scan. */
  scan?: ReconcileScan
  /** Initial `index_meta` entries. */
  meta?: Readonly<Record<string, string>>
  /**
   * Called after a call is recorded and before it takes effect. A returned
   * value other than `undefined` rejects the call with that value.
   */
  fail?: (call: IndexStoreCall) => unknown
}

export interface TestIndexStoreService extends IndexStoreService {
  /** Every call, in order, including calls that `fail` rejected. */
  calls(): readonly IndexStoreCall[]
  /** Every projection written by `apply` and `applyBatch`, in order. */
  applied(): readonly IndexedNote[]
  /** Every path passed to a successful `remove`, in order. */
  removed(): readonly string[]
  /** Every successful `move` and `moveIndexed`, in order. */
  moved(): readonly { readonly from: string; readonly to: string }[]
}

const EMPTY_SCAN: ReconcileScan = { total: 0, candidates: [], orphans: [], stalePlaceholders: [] }

/** An in-memory {@link IndexStoreService} that records every call. */
export function createTestIndexStoreService(
  options?: TestIndexStoreServiceOptions,
): TestIndexStoreService {
  const database = options?.database
  const generation = options?.generation ?? 1
  const scan = options?.scan ?? EMPTY_SCAN
  const fail = options?.fail
  const meta = new Map(Object.entries(options?.meta ?? {}))
  const log: IndexStoreCall[] = []
  const appliedNotes: IndexedNote[] = []
  const removedPaths: string[] = []
  const moves: { from: string; to: string }[] = []
  let metaSeeded = database === undefined

  function record(call: IndexStoreCall): void {
    log.push(call)
    const failure = fail?.(call)
    if (failure !== undefined) {
      throw failure
    }
  }

  async function seedMeta(): Promise<void> {
    if (metaSeeded || database === undefined) {
      return
    }
    metaSeeded = true
    for (const [key, value] of meta) {
      await writeMeta(key, value)
    }
  }

  async function writeMeta(key: string, value: string): Promise<void> {
    if (database === undefined) {
      meta.set(key, value)
      return
    }
    await database.runQuery('INSERT OR REPLACE INTO index_meta(key, value) VALUES (?, ?)', [
      key,
      value,
    ])
  }

  async function writeNotes(notes: readonly IndexedNote[]): Promise<void> {
    for (const note of notes) {
      if (database !== undefined) {
        await database.runQuery('DELETE FROM notes WHERE path = ?', [note.path])
        database.applyProjection(note)
      }
      appliedNotes.push(note)
    }
  }

  const applyBatch: IndexStoreService['applyBatch'] = async (notes, writeGeneration) => {
    record({ method: 'applyBatch', notes: [...notes], generation: writeGeneration })
    await writeNotes(notes)
  }

  const touch: IndexStoreService['touch'] = async (entries, writeGeneration) => {
    record({ method: 'touch', entries: [...entries], generation: writeGeneration })
  }

  return {
    open: async () => {
      record({ method: 'open' })
      return generation
    },
    apply: async (note, writeGeneration) => {
      record({ method: 'apply', note, generation: writeGeneration })
      await writeNotes([note])
    },
    applyBatch,
    remove: async (path, writeGeneration) => {
      record({ method: 'remove', path, generation: writeGeneration })
      await database?.runQuery('DELETE FROM notes WHERE path = ?', [path])
      removedPaths.push(path)
    },
    move: async (from, to, writeGeneration) => {
      record({ method: 'move', from, to, generation: writeGeneration })
      moves.push({ from, to })
    },
    moveIndexed: async (from, to, fileGeneration) => {
      record({ method: 'moveIndexed', from, to, fileGeneration })
      moves.push({ from, to })
    },
    reconcileScan: async (scanGeneration) => {
      record({ method: 'reconcileScan', generation: scanGeneration })
      return scan
    },
    touch,
    clear: async (writeGeneration) => {
      record({ method: 'clear', generation: writeGeneration })
      await database?.runQuery('DELETE FROM notes', [])
    },
    getMeta: async (key) => {
      record({ method: 'getMeta', key })
      if (database === undefined) {
        return meta.get(key) ?? null
      }
      await seedMeta()
      const row = await database.db
        .selectFrom('indexMeta')
        .where('key', '=', key)
        .select('value')
        .executeTakeFirst()
      return row?.value ?? null
    },
    setMeta: async (key, value, writeGeneration) => {
      record({ method: 'setMeta', key, value, generation: writeGeneration })
      await seedMeta()
      await writeMeta(key, value)
    },
    createApplyBatch: (writeGeneration, onSkippedNote) =>
      createIndexApplyBatchWriter(applyBatch, writeGeneration, onSkippedNote),
    createTouchBatch: (writeGeneration) => createMtimeTouchBatchWriter(touch, writeGeneration),
    calls: () => [...log],
    applied: () => [...appliedNotes],
    removed: () => [...removedPaths],
    moved: () => moves.map((move) => ({ ...move })),
  }
}
