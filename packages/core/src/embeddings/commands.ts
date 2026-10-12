import { z } from 'zod'
import type { Unlisten } from '../ipc/bridge.ts'
import { call } from '../ipc/invoke.ts'
import { defaultEmbeddingRuntime, type EmbedStatus } from './embedding-runtime-service.ts'

/** Typed bindings for the Rust embedding runtime + vector writes (Plan 09). */

export {
  embedProgressSchema,
  embedStatusSchema,
  type EmbedProgress,
  type EmbedStatus,
} from './embedding-runtime-service.ts'

const voidSchema = z.null()

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

/** One chunk in the `embed_apply` payload; `vector` only for new/changed. */
export interface EmbedChunkPayload {
  heading: string | null
  posFrom: number
  posTo: number
  text: string
  contentHash: string
  modelId: string
  vector: number[] | null
}

/** Replace a note's chunk set (hash-diff applied in Rust; generation-pinned). */
export async function embedApply(
  path: string,
  chunks: EmbedChunkPayload[],
  generation: number,
): Promise<void> {
  await call('embed_apply', { path, chunks, generation }, voidSchema)
}

/** Drop a deleted note's chunks + vectors (generation-pinned). */
export async function embedRemove(path: string, generation: number): Promise<void> {
  await call('embed_remove', { path, generation }, voidSchema)
}

/** Live runtime status changes (download started/finished/failed). */
export async function subscribeEmbedStatus(
  handler: (status: EmbedStatus) => void,
): Promise<Unlisten> {
  return defaultEmbeddingRuntime().subscribe(handler)
}
