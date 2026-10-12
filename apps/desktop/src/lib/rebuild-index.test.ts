import { setDefaultEmbeddingRuntime, setDefaultIndexLifecycle } from '@reflect/core'
import {
  createTestEmbeddingRuntimeService,
  createTestIndexLifecycleService,
  createTestIndexStoreService,
  createTestOperationsService,
  type TestIndexLifecycleService,
  type TestOperationsService,
} from '@reflect/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient, queryKeys } from '@/lib/query-client.ts'

const backfillEmbeddingsVisibly = vi.hoisted(() => vi.fn(async () => 'completed'))
vi.mock('@/lib/semantic.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/semantic.ts')>()),
  backfillEmbeddingsVisibly,
}))

const { rebuildIndexVisibly } = await import('./rebuild-index.ts')

let operations: TestOperationsService
let lifecycle: TestIndexLifecycleService

function installLifecycle(options?: { failClear?: boolean }): void {
  operations = createTestOperationsService()
  lifecycle = createTestIndexLifecycleService({
    operations,
    indexStore: createTestIndexStoreService({
      fail: (call) =>
        options?.failClear === true && call.method === 'clear'
          ? new Error('index on fire')
          : undefined,
    }),
  })
  setDefaultIndexLifecycle(lifecycle)
}

beforeEach(() => {
  backfillEmbeddingsVisibly.mockClear()
  setDefaultEmbeddingRuntime(
    createTestEmbeddingRuntimeService({ status: { status: 'uninitialized' } }),
  )
  installLifecycle()
})

afterEach(() => {
  setDefaultIndexLifecycle(null)
  setDefaultEmbeddingRuntime(null)
  vi.restoreAllMocks()
})

describe('rebuildIndexVisibly', () => {
  it('rebuilds through the index lifecycle and refreshes the index queries', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await rebuildIndexVisibly(7)

    expect(lifecycle.rebuilds()).toEqual([7])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
    // Semantic search is off: nothing to re-embed.
    expect(backfillEmbeddingsVisibly).not.toHaveBeenCalled()
  })

  it('re-runs the embedding backfill when the model is ready', async () => {
    setDefaultEmbeddingRuntime(
      createTestEmbeddingRuntimeService({ status: { status: 'ready', model: 'all-MiniLM-L6-v2' } }),
    )

    await rebuildIndexVisibly(7)
    await rebuildIndexVisibly(7)

    // index_clear wiped the embedding tables; each rebuild repopulates them once.
    expect(backfillEmbeddingsVisibly.mock.calls).toEqual([
      [{ generation: 7, modelId: 'all-MiniLM-L6-v2' }],
      [{ generation: 7, modelId: 'all-MiniLM-L6-v2' }],
    ])
  })

  it('coalesces a request made while the backfill is still running', async () => {
    setDefaultEmbeddingRuntime(
      createTestEmbeddingRuntimeService({ status: { status: 'ready', model: 'all-MiniLM-L6-v2' } }),
    )
    const backfill = Promise.withResolvers<string>()
    backfillEmbeddingsVisibly.mockImplementationOnce(() => backfill.promise)

    const first = rebuildIndexVisibly(7)
    await vi.waitFor(() => expect(backfillEmbeddingsVisibly).toHaveBeenCalledTimes(1))
    expect(rebuildIndexVisibly(7)).toBe(first)

    backfill.resolve('completed')
    await first
    expect(lifecycle.rebuilds()).toEqual([7, 7])
    expect(backfillEmbeddingsVisibly).toHaveBeenCalledTimes(1)
  })

  it('absorbs a failed rebuild without refreshing or re-embedding', async () => {
    installLifecycle({ failClear: true })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await expect(rebuildIndexVisibly(7)).resolves.toBeUndefined()

    expect(operations.findByLabel('Rebuilding search index')?.status).toBe('failed')
    expect(invalidate).not.toHaveBeenCalled()
    expect(backfillEmbeddingsVisibly).not.toHaveBeenCalled()
  })
})
