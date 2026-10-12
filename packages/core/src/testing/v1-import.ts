import {
  createV1ImportService,
  type V1ImportService,
  type V1ImportServiceDeps,
} from '../graph/v1-import-service.ts'
import { createTestClockService } from './clock.ts'
import { createTestFileChangeService } from './file-change.ts'
import { createTestGraphSessionService } from './graph-session.ts'
import { createTestIpcBridgeService } from './ipc.ts'
import { createTestLoggerService } from './logger.ts'

/**
 * The real {@link V1ImportService} over test doubles; each of `deps` defaults
 * to a fresh one. Give an `ipc` to answer `graph_import_reflect_v1_zip`.
 */
export function createTestV1ImportService(deps?: Partial<V1ImportServiceDeps>): V1ImportService {
  return createV1ImportService({
    ipc: deps?.ipc ?? createTestIpcBridgeService(),
    fileChanges: deps?.fileChanges ?? createTestFileChangeService(),
    graphSession: deps?.graphSession ?? createTestGraphSessionService(),
    clock: deps?.clock ?? createTestClockService(),
    logger: deps?.logger ?? createTestLoggerService(),
  })
}
