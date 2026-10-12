import type {
  AssetDescriptionService,
  AssetDescriptionSession,
  ReconcileAssetDescriptionsInput,
  ReconcileAssetDescriptionsOutcome,
} from '../assets/asset-description-service.ts'
import {
  createAssetPrivacyService,
  type AssetPrivacyService,
} from '../assets/asset-privacy-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { AssetReferences } from '../indexing/asset-refs.ts'
import type { XArchiveService } from '../x-archive.ts'
import { createTestXArchiveService } from './capture.ts'
import { createTestNoteFileService } from './graph.ts'

export interface TestAssetReferences extends AssetReferences {
  /** Set the notes the index reports as referencing `assetPath`. */
  set(assetPath: string, notePaths: readonly string[]): void
}

/**
 * {@link AssetReferences} that answer from a table instead of the index:
 * `references` maps an asset path to the notes that reference it.
 */
export function createTestAssetReferences(
  references?: Readonly<Record<string, readonly string[]>>,
): TestAssetReferences {
  const table = new Map(Object.entries(references ?? {}))
  return {
    notePaths: async (assetPath) => [...(table.get(assetPath) ?? [])],
    set(assetPath, notePaths) {
      table.set(assetPath, notePaths)
    },
  }
}

export interface TestAssetPrivacyServiceOptions {
  /** The notes the verdict reads live; defaults to an empty test note file service. */
  noteFile?: Pick<NoteFileService, 'read'>
  /** Defaults to a test X archive in which no asset has an owner. */
  xArchive?: Pick<XArchiveService, 'owners'>
  /** The candidate notes per asset; defaults to no references at all. */
  assetReferences?: AssetReferences
}

/** The real {@link AssetPrivacyService} over test doubles. */
export function createTestAssetPrivacyService(
  options?: TestAssetPrivacyServiceOptions,
): AssetPrivacyService {
  return createAssetPrivacyService({
    noteFile: options?.noteFile ?? createTestNoteFileService(),
    xArchive: options?.xArchive ?? createTestXArchiveService(),
    assetReferences: options?.assetReferences ?? createTestAssetReferences(),
  })
}

/** What happened to one session a {@link TestAssetDescriptionService} opened. */
export interface TestAssetDescriptionSessionState {
  generation: number
  /** How many times `start()` ran. */
  starts: number
  /** How many times `schedule()` ran. */
  schedules: number
  disposed: boolean
}

export interface TestAssetDescriptionService extends AssetDescriptionService {
  /** Every session opened, in order. */
  sessions(): readonly TestAssetDescriptionSessionState[]
  /** The input of every `reconcile` call, in order. */
  reconciles(): readonly ReconcileAssetDescriptionsInput[]
  /** The generation of every `backfillVisibly` call, in order. */
  backfills(): readonly number[]
  /** Notify every `onDescriptionsIndexed` listener. */
  emitDescriptionsIndexed(): void
}

/**
 * An {@link AssetDescriptionService} that only records its calls: no pass
 * ever runs, and `reconcile` and `backfillVisibly` answer an empty outcome.
 */
export function createTestAssetDescriptionService(): TestAssetDescriptionService {
  const states: TestAssetDescriptionSessionState[] = []
  const reconcileLog: ReconcileAssetDescriptionsInput[] = []
  const backfillLog: number[] = []
  const listeners = new Set<() => void>()

  function emptyOutcome(): ReconcileAssetDescriptionsOutcome {
    return {
      pending: 0,
      described: 0,
      skippedUpToDate: 0,
      skippedUnreferenced: 0,
      skippedPrivate: 0,
      skippedUserAuthored: 0,
      skippedOversize: 0,
      refused: 0,
      describedAssetPaths: [],
      stopped: null,
    }
  }

  return {
    async reconcile(input) {
      reconcileLog.push(input)
      return emptyOutcome()
    },
    openSession({ generation }): AssetDescriptionSession {
      const state: TestAssetDescriptionSessionState = {
        generation,
        starts: 0,
        schedules: 0,
        disposed: false,
      }
      states.push(state)
      return {
        start() {
          state.starts += 1
        },
        schedule() {
          state.schedules += 1
        },
        dispose() {
          state.disposed = true
        },
      }
    },
    async backfillVisibly(generation) {
      backfillLog.push(generation)
      return emptyOutcome()
    },
    onDescriptionsIndexed(listener) {
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    sessions: () => states.map((state) => ({ ...state })),
    reconciles: () => [...reconcileLog],
    backfills: () => [...backfillLog],
    emitDescriptionsIndexed() {
      for (const listener of listeners) {
        listener()
      }
    },
  }
}
