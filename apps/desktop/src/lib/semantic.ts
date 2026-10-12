import {
  backfillEmbeddings,
  defaultEmbeddingRuntime,
  defaultStorage,
  type EmbedStatus,
} from '@reflect/core'

/**
 * Semantic-search loading (Plan 09). The model is ~90MB and downloads from
 * the network, so it is **opt-in**: the `semanticSearchEnabled` setting flips
 * the persisted opt-in and `EmbeddingsSync` kicks the first download; later
 * launches auto-load from the local cache because the flag is set.
 * Acceptance: "first semantic use downloads the model with progress; later
 * uses are instant."
 */

/** Where the opt-in lived before it moved into the settings document. */
const LEGACY_ENABLED_KEY = 'reflect.semantic.enabled'

/**
 * Read-and-clear the pre-settings localStorage opt-in. Returns true exactly
 * once for a user who enabled semantic search before the flag moved into
 * settings — the caller persists it there and the key never matters again.
 */
export function consumeLegacySemanticOptIn(): boolean {
  const local = defaultStorage().local
  const enabled = local.get(LEGACY_ENABLED_KEY) === 'true'
  local.set(LEGACY_ENABLED_KEY, null)
  return enabled
}

/**
 * Re-kick a `failed` model load; a no-op for every other status. The explicit
 * enable actions (settings button, `semantic.enable` command) run this so
 * opting back in after a failure retries the download — EmbeddingsSync itself
 * only loads an `uninitialized` runtime, because reacting to `failed` would
 * loop a broken download forever.
 */
export async function retryFailedEmbeddings(): Promise<void> {
  await defaultEmbeddingRuntime().retry()
}

/** Load (downloading if needed) the model. Resolves with the outcome. */
export async function ensureEmbeddingsVisibly(): Promise<EmbedStatus> {
  const runtime = defaultEmbeddingRuntime()
  try {
    return await runtime.awaitTerminalStatus(await runtime.ensure())
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return { status: 'failed', message }
  }
}

/** Embed every indexed note (incremental — the hash-skip makes re-runs cheap). */
export async function backfillEmbeddingsVisibly(options: {
  generation: number
  modelId: string
  isStale?: () => boolean
}): Promise<'completed' | 'aborted' | 'failed'> {
  try {
    return await backfillEmbeddings(options)
  } catch {
    return 'failed'
  }
}
