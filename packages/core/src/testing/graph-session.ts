import { createGraphSession } from '../app/graph-session.ts'
import {
  createGraphSessionService,
  type GraphSessionService,
  type GraphSessionServiceDeps,
  type GraphSessionState,
} from '../graph/graph-session-service.ts'
import type { RecentGraph } from '../graph/schemas.ts'
import { createTestFileChangeService } from './file-change.ts'
import { createTestNoteFileService } from './graph.ts'
import { createTestIdService } from './id.ts'
import { createTestIndexLifecycleService } from './index-lifecycle.ts'
import { createTestIndexStoreService } from './index-store.ts'
import { createTestIpcBridgeService } from './ipc.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestMobileStorageService } from './mobile-storage.ts'
import { createTestPlatformService } from './platform.ts'
import {
  createTestDialogService,
  createTestLifecycleService,
  createTestWindowService,
} from './shell.ts'
import { createPathService, createPosixPathTransport } from '../app/path-service.ts'

/**
 * An open graph as a test names it. The defaults are the graph `test` at
 * `/graphs/test` with both generations 1. `indexGeneration: null` is a graph
 * whose index failed to open.
 */
export interface TestOpenGraph {
  root?: string
  name?: string
  generation?: number
  indexGeneration?: number | null
}

/** The services a test graph session runs on; each defaults to a fresh test double. */
export interface TestGraphSessionServiceOptions extends Partial<GraphSessionServiceDeps> {
  /** Start with this graph open (or with none), as {@link TestGraphSessionService.setGraph} does. */
  graph?: TestOpenGraph | null
  /** Reported over the real state from the start, as {@link TestGraphSessionService.setState} does. */
  state?: Partial<GraphSessionState>
  /** What the default `ipc` answers for `recent_graphs`. Unused when `ipc` is given. */
  recents?: readonly RecentGraph[]
}

export interface TestGraphSessionService extends GraphSessionService {
  /** Report `patch` over the real state and notify subscribers. */
  setState: (patch: Partial<GraphSessionState>) => void
  /**
   * Report `graph` as open and ready without an open flow, or `null` as the
   * graph chooser. The real service's own opens stay hidden behind it.
   */
  setGraph: (graph: TestOpenGraph | null) => void
}

function graphPatch(graph: TestOpenGraph | null): Partial<GraphSessionState> {
  if (graph === null) {
    return {
      status: 'choosing',
      graph: null,
      indexGeneration: null,
      indexing: false,
      error: null,
      session: null,
    }
  }
  const info = {
    root: graph.root ?? '/graphs/test',
    name: graph.name ?? 'test',
    generation: graph.generation ?? 1,
  }
  const indexGeneration = graph.indexGeneration === undefined ? 1 : graph.indexGeneration
  return {
    status: 'ready',
    graph: info,
    indexGeneration,
    indexing: false,
    error: null,
    session: indexGeneration === null ? null : createGraphSession({ ...info, indexGeneration }),
  }
}

function baseName(path: string): string {
  return path.split('/').findLast((segment) => segment !== '') ?? path
}

/**
 * The real {@link GraphSessionService} over test doubles, plus state seeding.
 * The default `ipc` opens any root as a graph named after its last path
 * segment, with a generation one above the previous open.
 */
export function createTestGraphSessionService(
  options?: TestGraphSessionServiceOptions,
): TestGraphSessionService {
  let recents = [...(options?.recents ?? [])]
  let generation = 0
  const createDefaultIpc = (): GraphSessionServiceDeps['ipc'] =>
    createTestIpcBridgeService({
      commands: {
        recent_graphs: () => recents,
        forget_recent: (args) => {
          recents = recents.filter((recent) => recent.root !== args['root'])
          return null
        },
        graph_open: (args) => {
          const root = String(args['path'])
          generation += 1
          return { root, name: baseName(root), generation }
        },
        graph_delete: () => null,
      },
    })
  const indexStore = options?.indexStore ?? createTestIndexStoreService()
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  const fileChanges = createTestFileChangeService()
  const logger = options?.logger ?? createTestLoggerService()
  const service = createGraphSessionService({
    ipc: options?.ipc ?? createDefaultIpc(),
    indexLifecycle:
      options?.indexLifecycle ??
      createTestIndexLifecycleService({ indexStore, noteFile, fileChanges, logger }),
    indexStore,
    noteFile,
    id: options?.id ?? createTestIdService(),
    fileChanges: options?.fileChanges ?? fileChanges,
    window: options?.window ?? createTestWindowService(),
    dialog: options?.dialog ?? createTestDialogService(),
    path: options?.path ?? createPathService({ transport: createPosixPathTransport('/home/test') }),
    platform: options?.platform ?? createTestPlatformService(),
    lifecycle: options?.lifecycle ?? createTestLifecycleService(),
    mobileStorage: options?.mobileStorage ?? createTestMobileStorageService(),
    logger,
  })

  const listeners = new Set<() => void>()
  let overlay: Partial<GraphSessionState> = {
    ...(options?.graph === undefined ? {} : graphPatch(options.graph)),
    ...options?.state,
  }
  let merged: { base: GraphSessionState; overlay: Partial<GraphSessionState> } | null = null
  let snapshot: GraphSessionState = service.getState()

  const setState = (patch: Partial<GraphSessionState>): void => {
    overlay = { ...overlay, ...patch }
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    ...service,
    getState: () => {
      const base = service.getState()
      if (merged?.base !== base || merged.overlay !== overlay) {
        merged = { base, overlay }
        snapshot = { ...base, ...overlay }
      }
      return snapshot
    },
    subscribe: (listener) => {
      const unlisten = service.subscribe(listener)
      listeners.add(listener)
      return () => {
        unlisten()
        listeners.delete(listener)
      }
    },
    setState,
    setGraph: (graph) => {
      setState(graphPatch(graph))
    },
  }
}
