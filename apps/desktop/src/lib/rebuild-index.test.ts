import {
  setDefaultEmbeddingIndex,
  setDefaultEmbeddingRuntime,
  setDefaultIndexLifecycle,
} from '@reflect/core'
import {
  createTestEmbeddingIndexService,
  createTestEmbeddingRuntimeService,
  createTestIndexLifecycleService,
  type TestEmbeddingIndexService,
  type TestIndexLifecycleService,
} from '@reflect/core/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { rebuildIndexVisibly } from './rebuild-index.ts'

// The rebuild is covered in `@reflect/core`, and what follows it in
// `semantic-search-service.test.ts` and `graph-index.test.ts`; these cover
// the delegation to the process-wide services.

let lifecycle: TestIndexLifecycleService
let embeddingIndex: TestEmbeddingIndexService

beforeEach(() => {
  lifecycle = createTestIndexLifecycleService()
  embeddingIndex = createTestEmbeddingIndexService({
    backfill: async () => 'completed',
  })
  setDefaultIndexLifecycle(lifecycle)
  setDefaultEmbeddingIndex(embeddingIndex)
  setDefaultEmbeddingRuntime(
    createTestEmbeddingRuntimeService({ status: { status: 'uninitialized' } }),
  )
})

afterEach(() => {
  setDefaultIndexLifecycle(null)
  setDefaultEmbeddingIndex(null)
  setDefaultEmbeddingRuntime(null)
})

describe('rebuildIndexVisibly', () => {
  it('rebuilds through the index lifecycle', async () => {
    await rebuildIndexVisibly(7)

    expect(lifecycle.rebuilds()).toEqual([7])
    // Semantic search is off: nothing to re-embed.
    expect(embeddingIndex.backfills()).toEqual([])
  })

  it('re-runs the embedding backfill when the model is ready', async () => {
    setDefaultEmbeddingRuntime(
      createTestEmbeddingRuntimeService({ status: { status: 'ready', model: 'all-MiniLM-L6-v2' } }),
    )

    await rebuildIndexVisibly(7)
    await rebuildIndexVisibly(7)

    // index_clear wiped the embedding tables; each rebuild repopulates them once.
    expect(embeddingIndex.backfills()).toEqual([
      { generation: 7, modelId: 'all-MiniLM-L6-v2' },
      { generation: 7, modelId: 'all-MiniLM-L6-v2' },
    ])
  })

  it('returns the in-flight request for a second call at the same generation', async () => {
    const first = rebuildIndexVisibly(7)
    expect(rebuildIndexVisibly(7)).toBe(first)
    await first
  })
})
