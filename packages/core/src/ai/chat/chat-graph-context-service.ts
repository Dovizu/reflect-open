import type { GraphStatsService } from '../../indexing/graph-stats-service.ts'
import type { CloudGraphContext, CloudSafe, PrivacyService } from '../../privacy/privacy-service.ts'

/**
 * The graph-level grounding block for one chat turn's system prompt: what
 * the graph is called, how many notes the assistant can see, the span of
 * the daily journal, and which tags exist — so tag filters and date ranges
 * are typed from knowledge, not guessed. Loaded fresh per turn (the stats
 * are three local SQLite reads), computed over non-private rows only.
 */

/** Most tags the prompt lists (token budget — the most-used tags win). */
export const MAX_CONTEXT_TAGS = 40

/** Loads the graph overview that a chat turn's system prompt carries. */
export interface ChatGraphContextService {
  /** Load the prompt context for the open graph, named `graphName`. */
  load: (graphName: string) => Promise<CloudSafe<CloudGraphContext>>
}

export function createChatGraphContextService(deps: {
  graphStats: Pick<GraphStatsService, 'loadGraphStats'>
  privacy: Pick<PrivacyService, 'cloudSafeGraphContext'>
}): ChatGraphContextService {
  const { graphStats, privacy } = deps
  return {
    load: async (graphName) => {
      const stats = await graphStats.loadGraphStats({ tagLimit: MAX_CONTEXT_TAGS })
      return privacy.cloudSafeGraphContext({ graphName, ...stats })
    },
  }
}
