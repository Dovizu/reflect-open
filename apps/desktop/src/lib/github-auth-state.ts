import type { GithubAuthService, Unlisten } from '@reflect/core'
import { queryClient, queryKeys } from '@/lib/query-client.ts'

/**
 * Refetch GitHub-connection state (the query `useGithubConnected` reads)
 * whenever `githubAuth` saves or clears the credential. Queries cache forever
 * (`staleTime: Infinity`), so the change must signal here, exactly like the
 * index-change invalidation.
 */
export function watchGithubAuth(githubAuth: GithubAuthService): Unlisten {
  return githubAuth.subscribe(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.github.authentication })
  })
}
