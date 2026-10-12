import { useQuery } from '@tanstack/react-query'
import { defaultGithubAuth } from '@reflect/core'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'
import { queryKeys } from '@/lib/query-client.ts'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/**
 * Whether a GitHub credential is stored on this machine (keychain presence,
 * not validity — a dead token surfaces at use time with its real error).
 * Gates GitHub-only affordances like private-link sharing; machine-level, so no
 * graph in the key. Kept fresh by `watchGithubAuth`, which refetches whenever
 * the `GithubAuthService` saves or clears the credential.
 */
export function useGithubConnected(): boolean {
  const githubAuth = useOptionalAppServices()?.githubAuth ?? defaultGithubAuth()
  const bridgeReady = useBridgeReady()
  const { data } = useQuery({
    queryKey: queryKeys.github.authentication,
    queryFn: async () => await githubAuth.isConnected(),
    enabled: bridgeReady,
  })
  return data ?? false
}
