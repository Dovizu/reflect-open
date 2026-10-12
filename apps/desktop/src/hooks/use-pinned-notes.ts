import { useQuery } from '@tanstack/react-query'
import { getPinnedNotes, type PinnedNote } from '@reflect/core'
import { queryKeys } from '@/lib/query-client.ts'
import { useGraph } from '@/providers/graph-provider.tsx'

/**
 * The pinned notes from the index, kept fresh by the usual index invalidation
 * (a pin lands in the file, the watcher re-indexes it, the query refetches).
 * Shared by the sidebar's Pinned section and the Recents dedup — one query
 * key, so both consumers ride a single fetch.
 */
export function usePinnedNotes(): PinnedNote[] {
  const { graph } = useGraph()
  const { data } = useQuery({
    queryKey: queryKeys.index.pinnedNotes(graph?.root),
    queryFn: () => getPinnedNotes(),
    enabled: graph !== null,
  })
  return data ?? []
}
