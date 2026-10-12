import { ReflectError } from '../errors.ts'
import type {
  ICloudNativeService,
  IcloudScanOptions,
  IcloudStatus,
  IcloudSweepOutcome,
} from '../ipc/icloud-native-service.ts'
import type { ClockService } from '../app/clock-service.ts'
import type { HttpService } from '../app/http-service.ts'
import {
  createBackupServiceFactory,
  type BackupService,
  type BackupServiceDeps,
  type BackupServiceFactory,
  type BackupState,
  type ConnectExistingResult,
} from '../sync/backup-service.ts'
import {
  createConflictResolutionService,
  type ConflictResolutionService,
  type ConflictResolutionServiceDeps,
} from '../sync/conflict-resolution-service.ts'
import { createSyncEngineFactory, type SyncEngineFactory } from '../sync/engine.ts'
import {
  createICloudDownloadServiceFactory,
  type ICloudDownloadServiceDeps,
  type ICloudDownloadServiceFactory,
} from '../sync/icloud-download-service.ts'
import {
  createICloudMigrationService,
  type ICloudMigrationService,
  type ICloudMigrationServiceDeps,
} from '../sync/icloud-migration-service.ts'
import {
  createICloudSyncServiceFactory,
  type ICloudSyncService,
  type ICloudSyncServiceDeps,
  type ICloudSyncServiceFactory,
} from '../sync/icloud-sync-service.ts'
import { createSyncStatusService, type SyncStatusService } from '../sync/sync-status-service.ts'
import type { SecretStoreService } from '../secrets/secret-store-service.ts'
import { createGistService, type GistService } from '../sync/gist-service.ts'
import {
  createGitHostCredentialService,
  type GitHostCredentialService,
} from '../sync/git-host-credential-service.ts'
import type {
  CommitOutcome,
  GitCredential,
  GitRepositoryService,
  GitStatus,
  MergeOutcome,
  PushOutcome,
  RemoteDelta,
} from '../sync/git-repository-service.ts'
import {
  createGithubAuthService,
  GITHUB_AUTH_SECRET,
  type GithubAuth,
  type GithubAuthService,
} from '../sync/github-auth-service.ts'
import {
  createGithubRepoService,
  type GithubRepoRef,
  type GithubRepoService,
} from '../sync/github-repo-service.ts'
import { createTestClockService } from './clock.ts'
import { createTestOpenDocumentsService } from './documents.ts'
import { createTestFileChangeService } from './file-change.ts'
import { createTestNoteFileService } from './graph.ts'
import { createTestHttpService } from './http.ts'
import { createTestIndexLifecycleService } from './index-lifecycle.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'
import { createTestPersistenceFlushService } from './persistence-flush.ts'
import { createTestPlatformService } from './platform.ts'
import { createTestSecretStoreService } from './secrets.ts'
import { createTestLifecycleService } from './shell.ts'

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

export interface TestGithubAuthOptions {
  /** The credential stored at the start; none by default. Ignored when `secretStore` is given. */
  auth?: GithubAuth
  /** Defaults to an in-memory keychain holding `auth`. */
  secretStore?: SecretStoreService
  /** Defaults to an HTTP fake with no routes. */
  http?: HttpService
  /** Defaults to a test clock. */
  clock?: ClockService
}

export interface TestGithubAuthService extends GithubAuthService {
  /**
   * Answer `runDeviceFlow` with `handler` instead of running the flow over
   * HTTP; `null` restores the real flow.
   */
  onRunDeviceFlow(handler: GithubAuthService['runDeviceFlow'] | null): void
}

/**
 * The real {@link GithubAuthService} over an in-memory keychain, an HTTP fake
 * and a test clock. `onRunDeviceFlow` scripts the device flow.
 */
export function createTestGithubAuthService(
  options?: TestGithubAuthOptions,
): TestGithubAuthService {
  const service = createGithubAuthService({
    secretStore:
      options?.secretStore ??
      createTestSecretStoreService(
        options?.auth === undefined ? {} : { [GITHUB_AUTH_SECRET]: JSON.stringify(options.auth) },
      ),
    http: options?.http ?? createTestHttpService(),
    clock: options?.clock ?? createTestClockService(),
  })
  let deviceFlow: GithubAuthService['runDeviceFlow'] | null = null
  return {
    ...service,
    runDeviceFlow: (flowOptions) => (deviceFlow ?? service.runDeviceFlow)(flowOptions),
    onRunDeviceFlow(handler) {
      deviceFlow = handler
    },
  }
}

/**
 * The real {@link GitHostCredentialService} over an in-memory keychain that
 * holds one sign-in per host of `credentials`. `credentials` is ignored when
 * `secretStore` is given.
 */
export function createTestGitHostCredentialService(options?: {
  credentials?: Record<string, GitCredential>
  secretStore?: SecretStoreService
}): GitHostCredentialService {
  const secrets = Object.fromEntries(
    Object.entries(options?.credentials ?? {}).map(([host, credential]) => [
      `git-host:${host.toLowerCase()}`,
      JSON.stringify(credential),
    ]),
  )
  return createGitHostCredentialService({
    secretStore: options?.secretStore ?? createTestSecretStoreService(secrets),
  })
}

/** The real {@link GithubRepoService} over `http`, an HTTP fake with no routes by default. */
export function createTestGithubRepoService(options?: { http?: HttpService }): GithubRepoService {
  return createGithubRepoService({ http: options?.http ?? createTestHttpService() })
}

/** The real {@link GistService} over `http`, an HTTP fake with no routes by default. */
export function createTestGistService(options?: { http?: HttpService }): GistService {
  return createGistService({ http: options?.http ?? createTestHttpService() })
}

/** The real {@link SyncEngineFactory} over `git` and `clock`; each defaults to a fresh test double. */
export function createTestSyncEngineFactory(options?: {
  git?: GitRepositoryService
  clock?: ClockService
}): SyncEngineFactory {
  return createSyncEngineFactory({
    git: options?.git ?? createTestGitRepositoryService(),
    clock: options?.clock ?? createTestClockService(),
  })
}

/**
 * The real {@link BackupServiceFactory} over `deps`; each service left out
 * defaults to a fresh test double. The default platform is a native desktop
 * shell, so a graph without a backup runs local history.
 */
export function createTestBackupServiceFactory(
  deps?: Partial<BackupServiceDeps>,
): BackupServiceFactory {
  const git = deps?.git ?? createTestGitRepositoryService()
  const fileChanges = deps?.fileChanges ?? createTestFileChangeService()
  return createBackupServiceFactory({
    git,
    syncEngines: deps?.syncEngines ?? createTestSyncEngineFactory({ git }),
    githubAuth: deps?.githubAuth ?? createTestGithubAuthService(),
    githubRepos: deps?.githubRepos ?? createTestGithubRepoService(),
    gitHostCredentials: deps?.gitHostCredentials ?? createTestGitHostCredentialService(),
    fileChanges,
    indexLifecycle: deps?.indexLifecycle ?? createTestIndexLifecycleService({ fileChanges }),
    operations: deps?.operations ?? createTestOperationsService(),
    lifecycle: deps?.lifecycle ?? createTestLifecycleService(),
    platform: deps?.platform ?? createTestPlatformService({ isNativeShell: true }),
    persistenceFlush: deps?.persistenceFlush ?? createTestPersistenceFlushService(),
    logger: deps?.logger ?? createTestLoggerService(),
  })
}

/** One recorded {@link TestBackupService} action. */
export type BackupCall =
  | { readonly method: 'start' | 'disconnectGraph' | 'signOut' | 'backUpNow' | 'dispose' }
  | { readonly method: 'connectNewRepo'; readonly name: string }
  | {
      readonly method: 'connectExistingRepo'
      readonly ref: GithubRepoRef
      readonly allowPublic: boolean
    }

export interface TestBackupService extends BackupService {
  /** Publish `state` as the backup state and notify subscribers. */
  setState(state: BackupState): void
  /** Every action called, in order. */
  calls(): readonly BackupCall[]
  /** Answer `connectNewRepo`; it resolves `connected` by default. */
  onConnectNewRepo(handler: BackupService['connectNewRepo']): void
  /** Answer `connectExistingRepo`; it resolves `connected` by default. */
  onConnectExistingRepo(handler: BackupService['connectExistingRepo']): void
}

/**
 * A scripted {@link BackupService}: it runs no engine and touches no
 * repository. The state starts at `state` (`loading` by default) and moves
 * only through `setState`; every action is recorded.
 */
export function createTestBackupService(options?: { state?: BackupState }): TestBackupService {
  let state: BackupState = options?.state ?? { phase: 'loading' }
  const listeners = new Set<() => void>()
  const log: BackupCall[] = []
  let connectNew: BackupService['connectNewRepo'] = async () => 'connected'
  let connectExisting: BackupService['connectExistingRepo'] =
    async (): Promise<ConnectExistingResult> => 'connected'

  return {
    start: async () => {
      log.push({ method: 'start' })
    },
    getState: () => state,
    subscribe: (listener) => {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    connectNewRepo: async (name) => {
      log.push({ method: 'connectNewRepo', name })
      return await connectNew(name)
    },
    connectExistingRepo: async (ref, connectOptions) => {
      log.push({
        method: 'connectExistingRepo',
        ref,
        allowPublic: connectOptions?.allowPublic ?? false,
      })
      return await connectExisting(ref, connectOptions)
    },
    disconnectGraph: async () => {
      log.push({ method: 'disconnectGraph' })
    },
    signOut: async () => {
      log.push({ method: 'signOut' })
    },
    backUpNow: async () => {
      log.push({ method: 'backUpNow' })
    },
    dispose: () => {
      log.push({ method: 'dispose' })
    },
    setState(next) {
      state = next
      for (const listener of listeners) {
        listener()
      }
    },
    calls: () => [...log],
    onConnectNewRepo(handler) {
      connectNew = handler
    },
    onConnectExistingRepo(handler) {
      connectExisting = handler
    },
  }
}

/**
 * The real {@link ICloudSyncServiceFactory} over `deps`; each service left
 * out defaults to a fresh test double.
 */
export function createTestICloudSyncServiceFactory(
  deps?: Partial<ICloudSyncServiceDeps>,
): ICloudSyncServiceFactory {
  const fileChanges = deps?.fileChanges ?? createTestFileChangeService()
  return createICloudSyncServiceFactory({
    icloudNative: deps?.icloudNative ?? createTestICloudNativeService(),
    fileChanges,
    indexLifecycle: deps?.indexLifecycle ?? createTestIndexLifecycleService({ fileChanges }),
    openDocuments: deps?.openDocuments ?? createTestOpenDocumentsService(),
    lifecycle: deps?.lifecycle ?? createTestLifecycleService(),
    clock: deps?.clock ?? createTestClockService(),
    logger: deps?.logger ?? createTestLoggerService(),
  })
}

export interface TestICloudSyncService extends ICloudSyncService {
  /** Every lifecycle method called, in order. */
  calls(): readonly ('start' | 'dispose')[]
}

/** A scripted {@link ICloudSyncService}: it sweeps nothing and records its lifecycle calls. */
export function createTestICloudSyncService(): TestICloudSyncService {
  const log: ('start' | 'dispose')[] = []
  return {
    start: async () => {
      log.push('start')
    },
    dispose: () => {
      log.push('dispose')
    },
    calls: () => [...log],
  }
}

/**
 * The real {@link ICloudDownloadServiceFactory} over `deps`; each service
 * left out defaults to a fresh test double.
 */
export function createTestICloudDownloadServiceFactory(
  deps?: Partial<ICloudDownloadServiceDeps>,
): ICloudDownloadServiceFactory {
  return createICloudDownloadServiceFactory({
    icloudNative: deps?.icloudNative ?? createTestICloudNativeService(),
    lifecycle: deps?.lifecycle ?? createTestLifecycleService(),
    clock: deps?.clock ?? createTestClockService(),
    logger: deps?.logger ?? createTestLoggerService(),
  })
}

/** The real {@link ICloudMigrationService} over `icloudNative`, a fresh test double by default. */
export function createTestICloudMigrationService(
  deps?: Partial<ICloudMigrationServiceDeps>,
): ICloudMigrationService {
  return createICloudMigrationService({
    icloudNative: deps?.icloudNative ?? createTestICloudNativeService(),
  })
}

/**
 * The real {@link ConflictResolutionService} over `deps`; each service left
 * out defaults to a fresh test double.
 */
export function createTestConflictResolutionService(
  deps?: Partial<ConflictResolutionServiceDeps>,
): ConflictResolutionService {
  const fileChanges = deps?.fileChanges ?? createTestFileChangeService()
  const noteFile = deps?.noteFile ?? createTestNoteFileService()
  return createConflictResolutionService({
    noteFile,
    indexLifecycle: deps?.indexLifecycle ?? createTestIndexLifecycleService(),
    fileChanges,
  })
}

/** The real {@link SyncStatusService}; it is a pure derivation. */
export function createTestSyncStatusService(): SyncStatusService {
  return createSyncStatusService()
}
