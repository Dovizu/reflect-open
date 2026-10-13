import type {
  AssetDescriptionService,
  AssetDescriptionSession,
  ReconcileAssetDescriptionsInput,
  ReconcileAssetDescriptionsOutcome,
} from '../assets/asset-description-service.ts'
import type { AssetReferences } from '../indexing/asset-refs.ts'

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
  /** How many times `backfillVisibly` ran. */
  backfills(): number
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
  let backfillCount = 0
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
    async backfillVisibly() {
      backfillCount += 1
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
    backfills: () => backfillCount,
    emitDescriptionsIndexed() {
      for (const listener of listeners) {
        listener()
      }
    },
  }
}
