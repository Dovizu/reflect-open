import { defaultIndexLifecycle, defaultSemanticSearch } from '@reflect/core'

/**
 * Full index rebuild with user-visible status (`IndexLifecycleService.rebuildVisibly`).
 * Followers of the lifecycle then refresh the query caches (`bindGraphIndex`)
 * and re-embed if semantic search is on (`SemanticSearchService`). Shared by
 * the `index.rebuild` palette command and the settings page's Rebuild index
 * button so the whole recipe stays one definition. Requests at the same
 * generation coalesce onto the in-flight pass, its re-embed included.
 */
export function rebuildIndexVisibly(generation: number): Promise<void> {
  // The semantic search service re-embeds from its creation on: make sure the
  // process-wide one exists before the rebuild reports.
  defaultSemanticSearch()
  return defaultIndexLifecycle().rebuildVisibly(generation)
}
