import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client.ts'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Whether a GitHub credential is stored on this machine (keychain presence,
 * not validity — a dead token surfaces at use time with its real error).
 * Gates GitHub-only affordances like private-link sharing; machine-level, so no
 * graph in the key. Kept fresh by `installQueryInvalidation`, which refetches whenever
 * the `GithubAuthService` saves or clears the credential.
 */
export function useGithubConnected(): boolean {
  const { githubAuth } = useAppServices()
  const { data } = useQuery({
    queryKey: queryKeys.github.authentication,
    queryFn: async () => await githubAuth.isConnected(),
  })
  return data ?? false
}
