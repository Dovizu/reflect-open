import { createGraphSession, type GraphInfo, type GraphSession } from '@reflect/core'

/** A {@link GraphSession} over today's graph state (`useGraph()` or `WindowBootstrap`); `null` while no index session is open. */
export function legacySession(
  state: { graph: GraphInfo; indexGeneration: number | null },
  signal?: AbortSignal,
): GraphSession | null {
  if (state.indexGeneration === null) {
    return null
  }
  return createGraphSession(
    {
      root: state.graph.root,
      name: state.graph.name,
      generation: state.graph.generation,
      indexGeneration: state.indexGeneration,
    },
    signal,
  )
}
