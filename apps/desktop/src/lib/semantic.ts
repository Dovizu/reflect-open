import { defaultSemanticSearch, type EmbedStatus, type SemanticSearchService } from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/** The {@link SemanticSearchService} of the nearest `AppServicesProvider`, else the process-wide one. */
export function useSemanticSearch(): SemanticSearchService {
  return useOptionalAppServices()?.semanticSearch ?? defaultSemanticSearch()
}

/** `defaultSemanticSearch().retryFailedModel`. */
export async function retryFailedEmbeddings(): Promise<void> {
  await defaultSemanticSearch().retryFailedModel()
}

/** `defaultSemanticSearch().ensureModel`. */
export async function ensureEmbeddingsVisibly(): Promise<EmbedStatus> {
  return await defaultSemanticSearch().ensureModel()
}
