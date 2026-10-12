import { useEffect } from 'react'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Keeps embeddings in sync with the graph (Plan 09) for as long as it is
 * mounted. Renders nothing; mounted once per workspace. The work itself is
 * `SemanticSearchService.start` in `@reflect/core`.
 */
export function EmbeddingsSync(): null {
  const { semanticSearch } = useAppServices()

  useEffect(() => semanticSearch.start(), [semanticSearch])

  return null
}
