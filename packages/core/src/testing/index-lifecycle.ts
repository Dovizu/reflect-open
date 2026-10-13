import type { ClockService } from '../app/clock-service.ts'
import type { GraphSession, GraphSessionSource } from '../app/graph-session.ts'
import type { HashService } from '../app/hash-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import type { FileChange, FileChangeService } from '../indexing/file-change-service.ts'
import {
  createIndexLifecycleService,
  type IndexAppliedEvent,
  type IndexFileProgress,
  type IndexLifecycleProgress,
  type IndexLifecycleService,
  type IndexReconciledEvent,
} from '../indexing/index-lifecycle-service.ts'
import { createIndexQueryService, type IndexQueryService } from '../indexing/index-query-service.ts'
import type { IndexStoreService } from '../indexing/index-store-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { XArchiveService } from '../x-archive.ts'
import { createTestXArchiveService } from './capture.ts'
import { createTestClockService } from './clock.ts'
import { createTestDatabaseService } from './database.ts'
import { createTestFileChangeService } from './file-change.ts'
import { createTestNoteFileService } from './graph.ts'
import { createTestHashService } from './id.ts'
import { createTestIndexStoreService } from './index-store.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'

/**
 * The services a test lifecycle runs on; each defaults to a fresh test double.
 */
export interface TestIndexLifecycleServiceOptions {
  indexStore?: IndexStoreService
  noteFile?: NoteFileService
  fileChanges?: FileChangeService
  /**
   * Read lazily, so the default (Node only) costs nothing until a pass reads rows.
   */
  database?: DatabaseService
  /**
   * Defaults to one over `database`.
   */
  indexQuery?: IndexQueryService
  xArchive?: XArchiveService
  hash?: HashService
  clock?: ClockService
  logger?: LoggerService
  operations?: OperationsService
  /**
   * Where `rebuildVisibly` reads the open graph from; defaults to no graph open.
   */
  graphSession?: GraphSessionSource
}

export interface TestIndexLifecycleService extends IndexLifecycleService {
  /**
   * Publish file progress as a running pass would; `null` clears it.
   */
  setFileProgress(progress: IndexFileProgress | null): void
  /**
   * The index generation of every `rebuildVisibly` request with an open index, in order.
   */
  rebuilds(): readonly number[]
  /**
   * Report `changes` as applied at `generation` to this lifecycle's
   * `onApplied` listeners, as an applied watcher batch (or, with `null`, a
   * sync pass) does.
   */
  emitApplied(changes: readonly FileChange[] | null, generation: number): void
}

class TestIndexLifecycleServiceImpl implements TestIndexLifecycleService {
  readonly #inner: IndexLifecycleService
  readonly #graphSession: GraphSessionSource
  readonly #rebuildLog: number[] = []
  readonly #seededListeners = new Set<() => void>()
  readonly #appliedListeners = new Set<(event: IndexAppliedEvent) => void>()
  #seeded: { progress: IndexFileProgress | null } | null = null

  constructor(inner: IndexLifecycleService, graphSession: GraphSessionSource) {
    this.#inner = inner
    this.#graphSession = graphSession
    inner.subscribeFileProgress(() => {
      this.#seeded = null
    })
  }

  open(): Promise<number | null> {
    return this.#inner.open()
  }

  sync(session: GraphSession): void {
    this.#inner.sync(session)
  }

  refresh(session: GraphSession): void {
    this.#inner.refresh(session)
  }

  stop(): Promise<void> {
    return this.#inner.stop()
  }

  settled(): Promise<void> {
    return this.#inner.settled()
  }

  close(): Promise<void> {
    return this.#inner.close()
  }

  suspend(): void {
    this.#inner.suspend()
  }

  resume(session: GraphSession | null): void {
    this.#inner.resume(session)
  }

  setSuspendGuard(shouldSuspend: (() => boolean) | null): void {
    this.#inner.setSuspendGuard(shouldSuspend)
  }

  onProgress(listener: (progress: IndexLifecycleProgress) => void): Unlisten {
    return this.#inner.onProgress(listener)
  }

  onApplied(listener: (event: IndexAppliedEvent) => void): Unlisten {
    const unlisten = this.#inner.onApplied(listener)
    this.#appliedListeners.add(listener)
    return () => {
      unlisten()
      this.#appliedListeners.delete(listener)
    }
  }

  applyChanges(
    changes: FileChange[],
    generation: number,
    canApply?: () => boolean,
  ): Promise<number> {
    return this.#inner.applyChanges(changes, generation, canApply)
  }

  onReconciled(listener: (event: IndexReconciledEvent) => void | Promise<void>): Unlisten {
    return this.#inner.onReconciled(listener)
  }

  onMoved(listener: (from: string, to: string) => void): Unlisten {
    return this.#inner.onMoved(listener)
  }

  onFileProgress(listener: (done: number, total: number, worked: number) => void): Unlisten {
    return this.#inner.onFileProgress(listener)
  }

  onStalePlaceholders(listener: (paths: readonly string[]) => void): Unlisten {
    return this.#inner.onStalePlaceholders(listener)
  }

  readonly fileProgress = (): IndexFileProgress | null =>
    this.#seeded !== null ? this.#seeded.progress : this.#inner.fileProgress()

  readonly subscribeFileProgress = (listener: () => void): Unlisten => {
    const unlisten = this.#inner.subscribeFileProgress(listener)
    this.#seededListeners.add(listener)
    return () => {
      unlisten()
      this.#seededListeners.delete(listener)
    }
  }

  rebuildVisibly(): Promise<void> {
    const generation = this.#graphSession.getState().session?.indexGeneration ?? null
    if (generation !== null) {
      this.#rebuildLog.push(generation)
    }
    return this.#inner.rebuildVisibly()
  }

  indexNote(
    path: string,
    options: { generation: number; content?: string | undefined; mtime?: number | undefined },
  ): Promise<void> {
    return this.#inner.indexNote(path, options)
  }

  reindexNotesReferencing(assetPaths: readonly string[], generation: number): Promise<void> {
    return this.#inner.reindexNotesReferencing(assetPaths, generation)
  }

  setFileProgress(progress: IndexFileProgress | null): void {
    this.#seeded = { progress }
    for (const listener of this.#seededListeners) {
      listener()
    }
  }

  rebuilds(): readonly number[] {
    return [...this.#rebuildLog]
  }

  emitApplied(changes: readonly FileChange[] | null, generation: number): void {
    for (const listener of this.#appliedListeners) {
      listener({ generation, changes })
    }
  }
}

/**
 * The real {@link IndexLifecycleService} over test doubles, plus seeding and a rebuild log.
 */
export function createTestIndexLifecycleService(
  options?: TestIndexLifecycleServiceOptions,
): TestIndexLifecycleService {
  const database = options?.database ?? createTestDatabaseService()
  const clock = options?.clock ?? createTestClockService()
  const graphSession: GraphSessionSource = options?.graphSession ?? {
    getState: () => ({ session: null }),
  }
  const inner = createIndexLifecycleService({
    indexStore: options?.indexStore ?? createTestIndexStoreService(),
    noteFile: options?.noteFile ?? createTestNoteFileService(),
    fileChanges: options?.fileChanges ?? createTestFileChangeService(),
    indexQuery: options?.indexQuery ?? createIndexQueryService({ database }),
    database,
    xArchive: options?.xArchive ?? createTestXArchiveService(),
    hash: options?.hash ?? createTestHashService(),
    clock,
    logger: options?.logger ?? createTestLoggerService(),
    operations: options?.operations ?? createTestOperationsService(),
    graphSession,
  })
  return new TestIndexLifecycleServiceImpl(inner, graphSession)
}
