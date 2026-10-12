import {
  defaultIndexLifecycle,
  errorMessage,
  icloudRequestDownloads,
  type IndexLifecycleService,
  type Unlisten,
} from '@reflect/core'
import { followHealedMove } from '@/editor/move-note.ts'
import { reloadOpenDocuments } from '@/editor/open-documents.ts'
import { throttledInvalidateIndexQueries } from '@/lib/query-client.ts'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/**
 * The active graph's index lifecycle (open → reconcile → subscribe → watch),
 * from the nearest `AppServicesProvider`, else the process-wide default. The
 * lifecycle itself lives in `@reflect/core`; this module is the desktop side
 * of it: what the app does when the index reports.
 */
export function useGraphIndex(): IndexLifecycleService {
  return useOptionalAppServices()?.indexLifecycle ?? defaultIndexLifecycle()
}

/**
 * Connect the app to `index`'s events until the returned function is called:
 * query-cache invalidation, open-document reloads, healed moves, and iCloud
 * download requests.
 */
export function bindGraphIndex(index: IndexLifecycleService): Unlisten {
  const unlisteners = [
    // Applied watcher batches stream every couple of seconds during a bulk
    // sync — the throttled variant collapses them to one refetch round per
    // window (an isolated batch still invalidates immediately).
    index.onApplied(throttledInvalidateIndexQueries),
    // A completed reconcile read changed files into the index without
    // per-file events; open sessions re-read so the visible note converges
    // with the index (unchanged files are no-op reads).
    index.onReconciled((event) => {
      if (event.source === 'sync') {
        reloadOpenDocuments()
      }
    }),
    // External renames healed by id follow through to sessions and routes,
    // exactly as for an in-app rename (Plan 17).
    index.onMoved(followHealedMove),
    // iCloud-evicted notes whose content the index lacks (never indexed
    // here, or remote-edited while evicted): request exactly those
    // downloads; the materialized files index via ordinary watcher
    // upserts. Non-iCloud graphs never list placeholders, so this never
    // fires for them. Rust resolves against the active root itself.
    index.onStalePlaceholders((paths) => {
      icloudRequestDownloads(paths).catch((err: unknown) => {
        console.error('iCloud download request failed:', errorMessage(err))
      })
    }),
  ]
  return () => {
    for (const unlisten of unlisteners) {
      unlisten()
    }
  }
}
