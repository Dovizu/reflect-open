import type { FetchFn } from './github-api.ts'
import { defaultGithubAuth } from './github-auth-service.ts'

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

/**
 * The token for git/API calls; see `GithubAuthService.getToken`. `_fetchFn` is
 * ignored: requests go through the service's `HttpService`.
 */
export async function getGithubToken(_fetchFn?: FetchFn): Promise<string | null> {
  return await defaultGithubAuth().getToken()
}
