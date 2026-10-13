import type { AppServices, Unlisten } from '@reflect/core'
import { invalidateIndexQueries, invalidateXPostQueries } from '@/lib/query-client.ts'

/**
 * Invalidate the queries that service events make stale. Queries cache
 * forever (`staleTime: Infinity`), so each write must signal here: archived X
 * posts after a capture pass, and the index-backed queries after new asset
 * descriptions.
 */
export function installQueryInvalidation(
  app: Pick<AppServices, 'capture' | 'assetDescription'>,
): Unlisten {
  const unlisteners = [
    app.capture.onXPostsWritten(invalidateXPostQueries),
    app.assetDescription.onDescriptionsIndexed(invalidateIndexQueries),
  ]
  return () => {
    for (const unlisten of unlisteners) {
      unlisten()
    }
  }
}
