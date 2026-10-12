import type { AppServices, Unlisten } from '@reflect/core'
import {
  invalidateIndexQueries,
  invalidateXPostQueries,
  queryClient,
  queryKeys,
} from '@/lib/query-client.ts'

/**
 * Invalidate the queries that service events make stale. Queries cache
 * forever (`staleTime: Infinity`), so each write must signal here: archived X
 * posts after a capture pass, the index-backed queries after new asset
 * descriptions, and the GitHub connection after a credential change.
 */
export function installQueryInvalidation(
  app: Pick<AppServices, 'capture' | 'assetDescription' | 'githubAuth'>,
): Unlisten {
  const unlisteners = [
    app.capture.onXPostsWritten(invalidateXPostQueries),
    app.assetDescription.onDescriptionsIndexed(invalidateIndexQueries),
    app.githubAuth.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.authentication })
    }),
  ]
  return () => {
    for (const unlisten of unlisteners) {
      unlisten()
    }
  }
}
