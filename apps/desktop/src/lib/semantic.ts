import { defaultSemanticSearch, type EmbedStatus, type SemanticSearchService } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/** The {@link SemanticSearchService} of the nearest `AppServicesProvider`. */
export function useSemanticSearch(): SemanticSearchService {
  return useAppServices().semanticSearch
}

/** `defaultSemanticSearch().retryFailedModel`. */
export async function retryFailedEmbeddings(): Promise<void> {
  await defaultSemanticSearch().retryFailedModel()
}

/** `defaultSemanticSearch().ensureModel`. */
export async function ensureEmbeddingsVisibly(): Promise<EmbedStatus> {
  return await defaultSemanticSearch().ensureModel()
}
