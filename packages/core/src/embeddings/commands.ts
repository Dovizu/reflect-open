import type { Unlisten } from '../ipc/bridge.ts'
import { defaultEmbeddingRuntime, type EmbedStatus } from './embedding-runtime-service.ts'

/** Typed bindings for the Rust embedding runtime + vector writes (Plan 09). */

export {
  embedProgressSchema,
  embedStatusSchema,
  type EmbedProgress,
  type EmbedStatus,
} from './embedding-runtime-service.ts'

export function embedStatus(): Promise<EmbedStatus> {
  return defaultEmbeddingRuntime().status()
}

/** Load (downloading on first use) the model. Resolves with the outcome. */
export function embedEnsure(): Promise<EmbedStatus> {
  return defaultEmbeddingRuntime().ensure()
}

/** Embed texts → 384-dim vectors. Errors unless status is `ready`. */
export function embedTexts(texts: string[]): Promise<number[][]> {
  return defaultEmbeddingRuntime().embedTexts(texts)
}

/** Live runtime status changes (download started/finished/failed). */
export async function subscribeEmbedStatus(
  handler: (status: EmbedStatus) => void,
): Promise<Unlisten> {
  return defaultEmbeddingRuntime().subscribe(handler)
}
