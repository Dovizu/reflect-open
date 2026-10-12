import type { GraphInfo } from '../graph/schemas.ts'
import type { MobileStorageInfo, MobileStorageService } from '../ipc/mobile-storage-service.ts'

export interface TestMobileStorageServiceOptions {
  /** What `resolve` answers. Defaults to a local-only device. */
  storage?: MobileStorageInfo
}

export interface TestMobileStorageService extends MobileStorageService {
  setStorage(storage: MobileStorageInfo): void
  /** The path of every `createGraph`, in order. */
  createdGraphs(): readonly string[]
}

function baseName(path: string): string {
  return path.split('/').findLast((segment) => segment !== '') ?? path
}

/**
 * An in-memory {@link MobileStorageService}. `createGraph` answers a graph
 * named after the last path segment, with generation `1`.
 */
export function createTestMobileStorageService(
  options?: TestMobileStorageServiceOptions,
): TestMobileStorageService {
  let storage: MobileStorageInfo = options?.storage ?? {
    localRoot: '/local/Documents',
    icloudDocumentsRoot: null,
    icloudGraphRoots: [],
  }
  const created: string[] = []

  return {
    resolve: async () => ({ ...storage, icloudGraphRoots: [...storage.icloudGraphRoots] }),
    resolveLocal: async () => storage.localRoot,
    createGraph: async (path): Promise<GraphInfo> => {
      created.push(path)
      return { root: path, name: baseName(path), generation: 1 }
    },
    setStorage(next) {
      storage = next
    },
    createdGraphs: () => [...created],
  }
}
