/**
 * GitHub specifics for backup/sync (Plan 12): device-flow auth, token
 * refresh, and the small REST surface (create/inspect the backup repo).
 *
 * Everything GitHub lives behind this public barrel by design — the Rust git
 * layer and sync engine are remote-agnostic, so supporting another host later
 * is a UX decision, not an engineering project.
 */
export { apiHeaders, JSON_HEADERS, readJson, type FetchFn } from './github-api.ts'
export {
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_SLUG,
  GITHUB_AUTH_SECRET,
  githubAppInstallUrl,
  isDeviceFlowConfigured,
  githubAuthSchema,
  getGithubToken,
  githubCredential,
  type DeviceFlowStart,
  type DevicePollResult,
  type GithubAuth,
  type GithubUser,
  type RunDeviceFlowOptions,
} from './github-auth.ts'
export {
  BACKUP_REPO_DESCRIPTION,
  githubRemoteUrl,
  newRepoUrl,
  parseGithubRemote,
  parseRepoInput,
  suggestRepoName,
  type GithubRepo,
  type GithubRepoRef,
} from './github-repos.ts'
