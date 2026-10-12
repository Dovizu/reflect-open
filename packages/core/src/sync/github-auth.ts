import type { FetchFn } from './github-api.ts'
import {
  defaultGithubAuth,
  type GithubAuth,
  type GithubUser,
  type RunDeviceFlowOptions,
} from './github-auth-service.ts'

export {
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_SLUG,
  GITHUB_AUTH_SECRET,
  githubAppInstallUrl,
  githubAuthSchema,
  githubCredential,
  isDeviceFlowConfigured,
  type DeviceFlowStart,
  type DevicePollResult,
  type GithubAuth,
  type GithubUser,
  type RunDeviceFlowOptions,
} from './github-auth-service.ts'

export async function saveGithubAuth(auth: GithubAuth): Promise<void> {
  await defaultGithubAuth().save(auth)
}

/** The stored credential, or `null` when absent or unreadable (re-connect). */
export async function loadGithubAuth(): Promise<GithubAuth | null> {
  return await defaultGithubAuth().load()
}

export async function clearGithubAuth(): Promise<void> {
  await defaultGithubAuth().clear()
}

/** Drive the whole device flow; see `GithubAuthService.runDeviceFlow`. */
export async function runDeviceFlow(options: RunDeviceFlowOptions): Promise<GithubAuth | null> {
  return await defaultGithubAuth().runDeviceFlow(options)
}

/**
 * The token for git/API calls; see `GithubAuthService.getToken`. `_fetchFn` is
 * ignored: requests go through the service's `HttpService`.
 */
export async function getGithubToken(_fetchFn?: FetchFn): Promise<string | null> {
  return await defaultGithubAuth().getToken()
}

/**
 * Who the token belongs to; see `GithubAuthService.getAuthenticatedUser`.
 * `_fetchFn` is ignored: requests go through the service's `HttpService`.
 */
export async function getAuthenticatedUser(token: string, _fetchFn?: FetchFn): Promise<GithubUser> {
  return await defaultGithubAuth().getAuthenticatedUser(token)
}
