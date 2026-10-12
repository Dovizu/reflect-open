import { defaultIndexLifecycle, embedStatus, type IndexLifecycleService } from '@reflect/core'
import { invalidateIndexQueries } from '@/lib/query-client.ts'
import { backfillEmbeddingsVisibly } from '@/lib/semantic.ts'

const followed = new WeakSet<IndexLifecycleService>()

/** Refresh the query caches and re-embed after each of `lifecycle`'s requested rebuilds. */
function followRebuilds(lifecycle: IndexLifecycleService): void {
  if (followed.has(lifecycle)) {
    return
  }
  followed.add(lifecycle)
  lifecycle.onReconciled(async ({ generation, source }) => {
    if (source !== 'rebuild') {
      return
    }
    // A manual rebuild bypasses the watcher pipeline (whose onApplied refreshes
    // the caches), so cached note lists, backlinks, and tags would otherwise
    // show pre-rebuild rows until some unrelated change invalidated them.
    invalidateIndexQueries()
    // index_clear wiped the embedding tables with everything else — rebuild
    // them too, or semantic search stays silently empty until some other
    // trigger re-embeds.
    const embed = await embedStatus()
    if (embed.status === 'ready') {
      await backfillEmbeddingsVisibly({ generation, modelId: embed.model })
    }
  })
}

/**
 * Full index rebuild with user-visible status (`IndexLifecycleService.rebuildVisibly`),
 * then refresh the query caches and re-embed if semantic search is on. Shared
 * by the `index.rebuild` palette command and the settings page's Rebuild index
 * button so the whole recipe stays one definition. Requests at the same
 * generation coalesce onto the in-flight pass, its re-embed included.
 */
export function rebuildIndexVisibly(generation: number): Promise<void> {
  const lifecycle = defaultIndexLifecycle()
  followRebuilds(lifecycle)
  return lifecycle.rebuildVisibly(generation)
}
