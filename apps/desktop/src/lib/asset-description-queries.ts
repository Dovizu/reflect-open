import type { AssetDescriptionService, Unlisten } from '@reflect/core'
import { invalidateIndexQueries } from '@/lib/query-client.ts'

/**
 * Refresh the index-backed queries whenever `assetDescription` folded new
 * descriptions into the search rows. That re-index writes rows directly (not
 * via the watcher), and the queries cache forever (`staleTime: Infinity`), so
 * the write must signal here for ⌘K to reflect the new descriptions.
 */
export function watchAssetDescriptions(assetDescription: AssetDescriptionService): Unlisten {
  return assetDescription.onDescriptionsIndexed(invalidateIndexQueries)
}
