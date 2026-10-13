import type {
  AssetDescriptionService,
  AssetDescriptionSession,
  AssetDescriptionSessionOptions,
  ReconcileAssetDescriptionsInput,
  ReconcileAssetDescriptionsOutcome,
} from '../assets/asset-description-service.ts'
import type { AssetReferences } from '../indexing/asset-refs.ts'
import type { Unlisten } from '../unlisten.ts'

export interface TestAssetReferences extends AssetReferences {
  /**
   * Set the notes the index reports as referencing `assetPath`.
   */
  set(assetPath: string, notePaths: readonly string[]): void
}

class TestAssetReferencesImpl implements TestAssetReferences {
  readonly #table: Map<string, readonly string[]>

  constructor(references?: Readonly<Record<string, readonly string[]>>) {
    this.#table = new Map(Object.entries(references ?? {}))
  }

  async notePaths(assetPath: string): Promise<string[]> {
    return [...(this.#table.get(assetPath) ?? [])]
  }

  set(assetPath: string, notePaths: readonly string[]): void {
    this.#table.set(assetPath, notePaths)
  }
}

/**
 * {@link AssetReferences} that answer from a table instead of the index:
 * `references` maps an asset path to the notes that reference it.
 */
export function createTestAssetReferences(
  references?: Readonly<Record<string, readonly string[]>>,
): TestAssetReferences {
  return new TestAssetReferencesImpl(references)
}

/**
 * What happened to one session a {@link TestAssetDescriptionService} opened.
 */
export interface TestAssetDescriptionSessionState {
  generation: number
  indexGeneration: number | null
  /**
   * How many times `start()` ran.
   */
  starts: number
  /**
   * How many times `schedule()` ran.
   */
  schedules: number
  disposed: boolean
}

export interface TestAssetDescriptionService extends AssetDescriptionService {
  /**
   * Every session opened, in order.
   */
  sessions(): readonly TestAssetDescriptionSessionState[]
  /**
   * The input of every `reconcile` call, in order.
   */
  reconciles(): readonly ReconcileAssetDescriptionsInput[]
  /**
   * How many times `backfillVisibly` ran.
   */
  backfills(): number
  /**
   * Notify every `onDescriptionsIndexed` listener.
   */
  emitDescriptionsIndexed(): void
}

class TestAssetDescriptionSessionImpl implements AssetDescriptionSession {
  readonly #state: TestAssetDescriptionSessionState

  constructor(state: TestAssetDescriptionSessionState) {
    this.#state = state
  }

  start(): void {
    this.#state.starts += 1
  }

  schedule(): void {
    this.#state.schedules += 1
  }

  dispose(): void {
    this.#state.disposed = true
  }
}

class TestAssetDescriptionServiceImpl implements TestAssetDescriptionService {
  readonly #states: TestAssetDescriptionSessionState[] = []
  readonly #reconcileLog: ReconcileAssetDescriptionsInput[] = []
  readonly #listeners = new Set<() => void>()
  #backfillCount = 0

  async reconcile(
    input: ReconcileAssetDescriptionsInput,
  ): Promise<ReconcileAssetDescriptionsOutcome> {
    this.#reconcileLog.push(input)
    return emptyOutcome()
  }

  openSession({
    generation,
    indexGeneration,
  }: AssetDescriptionSessionOptions): AssetDescriptionSession {
    const state: TestAssetDescriptionSessionState = {
      generation,
      indexGeneration,
      starts: 0,
      schedules: 0,
      disposed: false,
    }
    this.#states.push(state)
    return new TestAssetDescriptionSessionImpl(state)
  }

  async backfillVisibly(): Promise<ReconcileAssetDescriptionsOutcome> {
    this.#backfillCount += 1
    return emptyOutcome()
  }

  onDescriptionsIndexed(listener: () => void): Unlisten {
    const deliver = (): void => {
      listener()
    }
    this.#listeners.add(deliver)
    return () => {
      this.#listeners.delete(deliver)
    }
  }

  sessions(): readonly TestAssetDescriptionSessionState[] {
    return this.#states.map((state) => ({ ...state }))
  }

  reconciles(): readonly ReconcileAssetDescriptionsInput[] {
    return [...this.#reconcileLog]
  }

  backfills(): number {
    return this.#backfillCount
  }

  emitDescriptionsIndexed(): void {
    for (const listener of this.#listeners) {
      listener()
    }
  }
}

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

/**
 * An {@link AssetDescriptionService} that only records its calls: no pass
 * ever runs, and `reconcile` and `backfillVisibly` answer an empty outcome.
 */
export function createTestAssetDescriptionService(): TestAssetDescriptionService {
  return new TestAssetDescriptionServiceImpl()
}
