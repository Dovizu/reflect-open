import { ReflectError } from '../errors.ts'
import type {
  ICloudNativeService,
  IcloudScanOptions,
  IcloudStatus,
  IcloudSweepOutcome,
} from '../ipc/icloud-native-service.ts'
import type {
  CommitOutcome,
  GitRepositoryService,
  GitStatus,
  MergeOutcome,
  PushOutcome,
  RemoteDelta,
} from '../sync/git-repository-service.ts'

type GitMethod = keyof GitRepositoryService

/** One recorded {@link GitRepositoryService} call. */
export type GitRepositoryCall = {
  [M in GitMethod]: { readonly method: M; readonly args: Parameters<GitRepositoryService[M]> }
}[GitMethod]

/** Answers one {@link GitRepositoryService} method; may return the result directly or as a promise. */
export type GitRepositoryHandler<M extends GitMethod> = (
  ...args: Parameters<GitRepositoryService[M]>
) => Awaited<ReturnType<GitRepositoryService[M]>> | ReturnType<GitRepositoryService[M]>

export interface TestGitRepositoryService extends GitRepositoryService {
  calls(): readonly GitRepositoryCall[]
  onStatus(handler: GitRepositoryHandler<'status'>): void
  onSetup(handler: GitRepositoryHandler<'setup'>): void
  onDisconnect(handler: GitRepositoryHandler<'disconnect'>): void
  onCommitAll(handler: GitRepositoryHandler<'commitAll'>): void
  onFetch(handler: GitRepositoryHandler<'fetch'>): void
  onPush(handler: GitRepositoryHandler<'push'>): void
  onMergeRemote(handler: GitRepositoryHandler<'mergeRemote'>): void
}

/**
 * An in-memory {@link GitRepositoryService} that records every call. By
 * default `setup` and `disconnect` update the status, `commitAll` finds a
 * clean tree, `fetch` reports no delta, `push` succeeds and `mergeRemote` is
 * up to date; the `onXxx` setters replace one method's answer.
 */
export function createTestGitRepositoryService(
  initialStatus?: Partial<GitStatus>,
): TestGitRepositoryService {
  let status: GitStatus = {
    initialized: false,
    branch: null,
    remoteUrl: null,
    ahead: 0,
    behind: 0,
    inProgress: false,
    ...initialStatus,
  }
  const log: GitRepositoryCall[] = []
  const handlers: { [M in GitMethod]: GitRepositoryHandler<M> } = {
    status: () => ({ ...status }),
    setup: (remoteUrl, branch) => {
      status = {
        ...status,
        initialized: true,
        remoteUrl,
        branch: branch ?? status.branch ?? 'main',
      }
      return { ...status }
    },
    disconnect: () => {
      status = { ...status, remoteUrl: null }
      return { ...status }
    },
    commitAll: (): CommitOutcome => ({
      committed: false,
      sha: null,
      ahead: 0,
      skippedLargeFiles: [],
    }),
    fetch: (): RemoteDelta => ({ ahead: 0, behind: 0 }),
    push: (): PushOutcome => ({ pushed: true, nonFastForward: false, rejectionMessage: null }),
    mergeRemote: (): MergeOutcome => ({ kind: 'upToDate', conflictedPaths: [], changedFiles: [] }),
  }

  return {
    status: async (generation) => {
      log.push({ method: 'status', args: [generation] })
      return await handlers.status(generation)
    },
    setup: async (remoteUrl, branch, generation) => {
      log.push({ method: 'setup', args: [remoteUrl, branch, generation] })
      return await handlers.setup(remoteUrl, branch, generation)
    },
    disconnect: async (generation) => {
      log.push({ method: 'disconnect', args: [generation] })
      return await handlers.disconnect(generation)
    },
    commitAll: async (fallbackMessage, generation) => {
      log.push({ method: 'commitAll', args: [fallbackMessage, generation] })
      return await handlers.commitAll(fallbackMessage, generation)
    },
    fetch: async (credential, generation) => {
      log.push({ method: 'fetch', args: [credential, generation] })
      return await handlers.fetch(credential, generation)
    },
    push: async (credential, generation) => {
      log.push({ method: 'push', args: [credential, generation] })
      return await handlers.push(credential, generation)
    },
    mergeRemote: async (generation) => {
      log.push({ method: 'mergeRemote', args: [generation] })
      return await handlers.mergeRemote(generation)
    },
    calls: () => [...log],
    onStatus(handler) {
      handlers.status = handler
    },
    onSetup(handler) {
      handlers.setup = handler
    },
    onDisconnect(handler) {
      handlers.disconnect = handler
    },
    onCommitAll(handler) {
      handlers.commitAll = handler
    },
    onFetch(handler) {
      handlers.fetch = handler
    },
    onPush(handler) {
      handlers.push = handler
    },
    onMergeRemote(handler) {
      handlers.mergeRemote = handler
    },
  }
}

type ICloudCommand = Exclude<
  keyof ICloudNativeService,
  'subscribeConflicts' | 'subscribeWatchFailed'
>

/** One recorded {@link ICloudNativeService} command call. */
export type ICloudNativeCall = {
  [M in ICloudCommand]: { readonly method: M; readonly args: Parameters<ICloudNativeService[M]> }
}[ICloudCommand]

export interface TestICloudNativeService extends ICloudNativeService {
  calls(): readonly ICloudNativeCall[]
  setStatus(status: Partial<IcloudStatus>): void
  /** What `downloadPending` and `pendingCount` report from now on. */
  setPendingCount(count: number): void
  onConflictsScan(
    handler: (options: IcloudScanOptions) => IcloudSweepOutcome | Promise<IcloudSweepOutcome>,
  ): void
  emitConflicts(paths: string[]): void
  emitWatchFailed(): void
}

/**
 * An in-memory {@link ICloudNativeService}. The container is unavailable
 * unless `status` says otherwise; `adoptGraph` answers `<documentsRoot>/Notes`
 * and rejects with an `io` error while unavailable; sweeps change nothing.
 */
export function createTestICloudNativeService(options?: {
  status?: Partial<IcloudStatus>
  pendingCount?: number
}): TestICloudNativeService {
  let status: IcloudStatus = {
    available: false,
    documentsRoot: null,
    existingGraphRoots: [],
    ...options?.status,
  }
  let pending = options?.pendingCount ?? 0
  let scan: (
    scanOptions: IcloudScanOptions,
  ) => IcloudSweepOutcome | Promise<IcloudSweepOutcome> = () => ({
    changed: [],
    needsReview: [],
    deferred: [],
    autoResolved: 0,
  })
  const log: ICloudNativeCall[] = []
  const conflictListeners = new Set<(paths: string[]) => void>()
  const watchFailedListeners = new Set<() => void>()

  return {
    status: async () => {
      log.push({ method: 'status', args: [] })
      return { ...status, existingGraphRoots: [...status.existingGraphRoots] }
    },
    adoptGraph: async (generation) => {
      log.push({ method: 'adoptGraph', args: [generation] })
      if (!status.available || status.documentsRoot === null) {
        throw new ReflectError('io', 'test iCloud: the container is unavailable')
      }
      return `${status.documentsRoot}/Notes`
    },
    conflictsScan: async (scanOptions) => {
      log.push({ method: 'conflictsScan', args: [scanOptions] })
      return await scan(scanOptions)
    },
    watchStart: async (root) => {
      log.push({ method: 'watchStart', args: [root] })
    },
    watchStop: async () => {
      log.push({ method: 'watchStop', args: [] })
    },
    downloadPending: async (root, scope) => {
      log.push({ method: 'downloadPending', args: [root, scope] })
      return pending
    },
    pendingCount: async (root, scope) => {
      log.push({ method: 'pendingCount', args: [root, scope] })
      return pending
    },
    requestDownloads: async (paths) => {
      log.push({ method: 'requestDownloads', args: [paths] })
      return paths.length
    },
    subscribeConflicts: (listener) => {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver = (paths: string[]): void => {
        listener(paths)
      }
      conflictListeners.add(deliver)
      return () => {
        conflictListeners.delete(deliver)
      }
    },
    subscribeWatchFailed: (listener) => {
      const deliver = (): void => {
        listener()
      }
      watchFailedListeners.add(deliver)
      return () => {
        watchFailedListeners.delete(deliver)
      }
    },
    calls: () => [...log],
    setStatus(next) {
      status = { ...status, ...next }
    },
    setPendingCount(count) {
      pending = count
    },
    onConflictsScan(handler) {
      scan = handler
    },
    emitConflicts(paths) {
      for (const listener of conflictListeners) {
        listener([...paths])
      }
    },
    emitWatchFailed() {
      for (const listener of watchFailedListeners) {
        listener()
      }
    },
  }
}
