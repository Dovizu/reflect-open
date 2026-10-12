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
  createTestPathService,
  createTestWindowService,
} from './shell.ts'

/** The services a test graph session runs on; each defaults to a fresh test double. */
export interface TestGraphSessionServiceOptions extends Partial<GraphSessionServiceDeps> {
  /** Reported over the real state from the start, as {@link TestGraphSessionService.setState} does. */
  state?: Partial<GraphSessionState>
  /** What the default `ipc` answers for `recent_graphs`. Unused when `ipc` is given. */
  recents?: readonly RecentGraph[]
}

export interface TestGraphSessionService extends GraphSessionService {
  /** Report `patch` over the real state and notify subscribers. */
  setState: (patch: Partial<GraphSessionState>) => void
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
    path: options?.path ?? createTestPathService(),
    platform: options?.platform ?? createTestPlatformService(),
    lifecycle: options?.lifecycle ?? createTestLifecycleService(),
    mobileStorage: options?.mobileStorage ?? createTestMobileStorageService(),
    logger,
  })

  const listeners = new Set<() => void>()
  let overlay: Partial<GraphSessionState> = options?.state ?? {}
  let merged: { base: GraphSessionState; overlay: Partial<GraphSessionState> } | null = null
  let snapshot: GraphSessionState = service.getState()

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
    setState: (patch) => {
      overlay = { ...overlay, ...patch }
      for (const listener of listeners) {
        listener()
      }
    },
  }
}
