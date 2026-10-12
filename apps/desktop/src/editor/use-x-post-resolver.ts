import type { AppServices, GraphInfo } from '@reflect/core'
import type { XPostResolver } from '@meowdown/core'
import { queryOptions } from '@tanstack/react-query'
import { parseXPostId } from '@post-embed/schema'
import { queryClient, queryKeys } from '@/lib/query-client.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

/** The services the X post archive reads go through. */
export type XPostContext = Pick<AppServices, 'embedMedia'>

export const X_MEDIA_URL_PROTOCOLS = ['reflect-asset:']

// An archive no note shows is dropped this long after its last read.
const X_POST_GC_TIME_MS = 30 * 60 * 1000

export function xPostQueryOptions(ctx: XPostContext, generation: number, id: string) {
  return queryOptions({
    queryKey: queryKeys.xPost.archive(generation, id),
    queryFn: () => ctx.embedMedia.loadXPost(generation, id),
    // A found archive stays fresh until a capture invalidates it; a missing one is read again.
    staleTime: (query) => (query.state.data == null ? 0 : Infinity),
    gcTime: X_POST_GC_TIME_MS,
    retry: false,
  })
}

export function createXPostResolver(ctx: XPostContext, generation: number | null): XPostResolver {
  return (url) => {
    const id = parseXPostId(url)
    if (!id || generation === null) return
    const options = xPostQueryOptions(ctx, generation, id)
    const state = queryClient.getQueryState(options.queryKey)
    if (state?.data && !state.isInvalidated) return state.data
    return queryClient.query(options).then((post) => post ?? undefined)
  }
}

// One resolver per graph keeps the editor's `resolveXPost` prop stable.
const resolvers = new WeakMap<GraphInfo, XPostResolver>()
const emptyResolver: XPostResolver = () => undefined

export function getXPostResolver(ctx: XPostContext, graph: GraphInfo | null): XPostResolver {
  if (!graph) return emptyResolver
  let resolver = resolvers.get(graph)
  if (!resolver) {
    resolver = createXPostResolver(ctx, graph.generation)
    resolvers.set(graph, resolver)
  }
  return resolver
}

export function useXPostResolver() {
  const { embedMedia } = useAppServices()
  return getXPostResolver({ embedMedia }, useGraph({ optional: true })?.graph ?? null)
}
