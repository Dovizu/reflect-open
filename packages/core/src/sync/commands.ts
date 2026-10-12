import { defaultGitRepository, type GitRepositoryService } from './git-repository-service.ts'

/**
 * Typed bindings for the Rust git primitives (Plan 12), as free functions
 * over {@link defaultGitRepository}. Policy (cadence, retries, product
 * states) is `./engine`'s job; these are the verbs it composes.
 */

export {
  changedFileSchema,
  commitOutcomeSchema,
  gitStatusSchema,
  mergeOutcomeSchema,
  pushOutcomeSchema,
  remoteDeltaSchema,
  skippedFileSchema,
  type ChangedFile,
  type CommitOutcome,
  type GitCredential,
  type GitStatus,
  type MergeOutcome,
  type PushOutcome,
  type RemoteDelta,
  type SkippedFile,
} from './git-repository-service.ts'

export const gitStatus: GitRepositoryService['status'] = (...args) =>
  defaultGitRepository().status(...args)
export const gitSetup: GitRepositoryService['setup'] = (...args) =>
  defaultGitRepository().setup(...args)
export const gitDisconnect: GitRepositoryService['disconnect'] = (...args) =>
  defaultGitRepository().disconnect(...args)
export const gitCommitAll: GitRepositoryService['commitAll'] = (...args) =>
  defaultGitRepository().commitAll(...args)
export const gitFetch: GitRepositoryService['fetch'] = (...args) =>
  defaultGitRepository().fetch(...args)
export const gitMergeRemote: GitRepositoryService['mergeRemote'] = (...args) =>
  defaultGitRepository().mergeRemote(...args)
export const gitPush: GitRepositoryService['push'] = (...args) =>
  defaultGitRepository().push(...args)
