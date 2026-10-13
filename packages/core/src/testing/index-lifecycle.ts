import type { ClockService } from '../app/clock-service.ts'
import type { GraphSessionSource } from '../app/graph-session.ts'
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
  type IndexLifecycleService,
} from '../indexing/index-lifecycle-service.ts'
import { createIndexQueryService, type IndexQueryService } from '../indexing/index-query-service.ts'
import type { IndexStoreService } from '../indexing/index-store-service.ts'
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

/** The services a test lifecycle runs on; each defaults to a fresh test double. */
export interface TestIndexLifecycleServiceOptions {
  indexStore?: IndexStoreService
  noteFile?: NoteFileService
  fileChanges?: FileChangeService
  /** Read lazily, so the default (Node only) costs nothing until a pass reads rows. */
  database?: DatabaseService
  /** Defaults to one over `database`. */
  indexQuery?: IndexQueryService
  xArchive?: XArchiveService
  hash?: HashService
  clock?: ClockService
  logger?: LoggerService
  operations?: OperationsService
  /** Where `rebuildVisibly` reads the open graph from; defaults to no graph open. */
  graphSession?: GraphSessionSource
}

export interface TestIndexLifecycleService extends IndexLifecycleService {
  /** Publish file progress as a running pass would; `null` clears it. */
  setFileProgress: (progress: IndexFileProgress | null) => void
  /** The index generation of every `rebuildVisibly` request with an open index, in order. */
  rebuilds: () => readonly number[]
  /**
   * Report `changes` as applied at `generation` to this lifecycle's
   * `onApplied` listeners, as an applied watcher batch (or, with `null`, a
   * sync pass) does.
   */
  emitApplied: (changes: readonly FileChange[] | null, generation: number) => void
}

/** The real {@link IndexLifecycleService} over test doubles, plus seeding and a rebuild log. */
export function createTestIndexLifecycleService(
  options?: TestIndexLifecycleServiceOptions,
): TestIndexLifecycleService {
  const database = options?.database ?? createTestDatabaseService()
  const clock = options?.clock ?? createTestClockService()
  const graphSession: GraphSessionSource = options?.graphSession ?? {
    getState: () => ({ session: null }),
  }
  const service = createIndexLifecycleService({
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
  const rebuildLog: number[] = []
  const seededListeners = new Set<() => void>()
  const appliedListeners = new Set<(event: IndexAppliedEvent) => void>()
  let seeded: { progress: IndexFileProgress | null } | null = null
  service.subscribeFileProgress(() => {
    seeded = null
  })
  return {
    ...service,
    fileProgress: () => (seeded !== null ? seeded.progress : service.fileProgress()),
    subscribeFileProgress: (listener) => {
      const unlisten = service.subscribeFileProgress(listener)
      seededListeners.add(listener)
      return () => {
        unlisten()
        seededListeners.delete(listener)
      }
    },
    rebuildVisibly: () => {
      const generation = graphSession.getState().session?.indexGeneration ?? null
      if (generation !== null) {
        rebuildLog.push(generation)
      }
      return service.rebuildVisibly()
    },
    setFileProgress: (progress) => {
      seeded = { progress }
      for (const listener of seededListeners) {
        listener()
      }
    },
    rebuilds: () => [...rebuildLog],
    onApplied: (listener) => {
      const unlisten = service.onApplied(listener)
      appliedListeners.add(listener)
      return () => {
        unlisten()
        appliedListeners.delete(listener)
      }
    },
    emitApplied: (changes, generation) => {
      for (const listener of appliedListeners) {
        listener({ generation, changes })
      }
    },
  }
}
