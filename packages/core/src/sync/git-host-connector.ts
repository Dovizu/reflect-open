import { parseUrl } from '@reflect/utils'
import { AppError } from '../errors.ts'
import type { GitHostCredentialService } from './git-host-credential-service.ts'
import type { GitRepositoryService } from './git-repository-service.ts'
import type { GitSyncService } from './git-sync-service.ts'
import { classifyRemote } from './remote-url.ts'

/**
 * What the "Another host" form submits.
 */
export interface ConnectGitHostInput {
  remoteUrl: string
  username: string
  token: string
}

/**
 * Connects the open graph to an HTTPS git host other than github.com
 * (GitLab, Gitea, Codeberg, a server of your own) with a username and an
 * access token.
 */
export interface GitHostConnector {
  /**
   * Validate the URL, make sure the repository exists, probe the host with
   * the sign-in, and only then store the sign-in and point `origin` at the
   * URL. A refused probe stores nothing, so a wrong URL or token fails here
   * with the host's own answer. A remote that already holds notes on
   * another branch keeps it: the local branch takes that name.
   */
  connectGitHost(input: ConnectGitHostInput): Promise<void>
}

export interface GitHostConnectorDeps {
  readonly git: GitRepositoryService
  readonly gitHostCredentials: GitHostCredentialService
  readonly gitSync: Pick<GitSyncService, 'connectRemote'>
  /**
   * The open graph's generation — every git command is pinned to it.
   */
  readonly generation: number
}

class GitHostConnectorImpl implements GitHostConnector {
  readonly #deps: GitHostConnectorDeps

  constructor(deps: GitHostConnectorDeps) {
    this.#deps = deps
  }

  async connectGitHost({ remoteUrl, username, token }: ConnectGitHostInput): Promise<void> {
    const { git, gitHostCredentials, gitSync, generation } = this.#deps
    const url = remoteUrl.trim()
    const remote = classifyRemote(url)
    if (remote.kind === 'github') {
      throw new AppError('parse', 'This is a GitHub repository: connect it with GitHub.')
    }
    // The token travels encrypted and lives in the keychain only: plain
    // http, and a sign-in written into the URL, are refused.
    const parsed = parseUrl(url)
    if (
      remote.kind !== 'https' ||
      parsed === null ||
      parsed.protocol !== 'https:' ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      throw new AppError(
        'parse',
        'Enter the repository’s https:// URL, without a username or token in it.',
      )
    }
    const credential = { username: username.trim(), secret: token.trim() }
    if (credential.username.length === 0 || credential.secret.length === 0) {
      throw new AppError('parse', 'Enter the username and the access token.')
    }
    await git.setup(null, null, generation) // the repository the probe runs from
    const tip = await git.remoteHead(credential, generation, url)
    await gitHostCredentials.save(remote.origin, credential)
    await gitSync.connectRemote(url, tip.defaultBranch)
  }
}

export function createGitHostConnector(deps: GitHostConnectorDeps): GitHostConnector {
  return new GitHostConnectorImpl(deps)
}
