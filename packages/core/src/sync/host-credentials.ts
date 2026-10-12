import { defaultGitHostCredentials } from './git-host-credential-service.ts'
import type { GitCredential } from './git-repository-service.ts'

export { remoteHost } from './git-host-credential-service.ts'

/** The stored sign-in for `host`, or `null` when absent or unreadable. */
export async function loadHostCredential(host: string): Promise<GitCredential | null> {
  return await defaultGitHostCredentials().load(host)
}
