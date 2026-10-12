import type { FetchFn } from './github-api.ts'
import { defaultGithubRepos, type GithubRepo, type GithubRepoRef } from './github-repo-service.ts'

export {
  BACKUP_REPO_DESCRIPTION,
  githubRemoteUrl,
  newRepoUrl,
  parseGithubRemote,
  parseRepoInput,
  suggestRepoName,
  type GithubRepo,
  type GithubRepoRef,
} from './github-repo-service.ts'

/**
 * Create a repo for the signed-in user; see `GithubRepoService.createRepo`.
 * `fetchFn` is ignored: requests go through the service's `HttpService`.
 */
export async function createGithubRepo(
  token: string,
  name: string,
  options?: { isPrivate?: boolean; fetchFn?: FetchFn },
): Promise<GithubRepo | null> {
  return await defaultGithubRepos().createRepo(token, name, {
    isPrivate: options?.isPrivate ?? true,
  })
}

/**
 * Look up a repo; see `GithubRepoService.getRepo`. `_fetchFn` is ignored:
 * requests go through the service's `HttpService`.
 */
export async function getGithubRepo(
  token: string,
  ref: GithubRepoRef,
  _fetchFn?: FetchFn,
): Promise<GithubRepo | null> {
  return await defaultGithubRepos().getRepo(token, ref)
}
