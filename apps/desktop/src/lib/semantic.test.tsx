import { afterEach, describe, expect, it, vi } from 'vitest'
import { setDefaultEmbeddingRuntime } from '@reflect/core'
import { createTestEmbeddingRuntimeService } from '@reflect/core/testing'
import { ensureEmbeddingsVisibly, retryFailedEmbeddings } from './semantic.ts'

// The service itself is covered in `@reflect/core`; these cover the
// delegations to the process-wide one.

afterEach(() => {
  setDefaultEmbeddingRuntime(null)
})

describe('retryFailedEmbeddings', () => {
  it('re-kicks a failed load', async () => {
    const runtime = createTestEmbeddingRuntimeService({
      status: { status: 'failed', message: 'offline' },
    })
    setDefaultEmbeddingRuntime(runtime)
    await retryFailedEmbeddings()
    expect(runtime.ensureCalls()).toBe(1)
  })

  it('is a no-op for any other status', async () => {
    const runtime = createTestEmbeddingRuntimeService({
      status: { status: 'ready', model: 'all-MiniLM-L6-v2' },
    })
    setDefaultEmbeddingRuntime(runtime)
    await retryFailedEmbeddings()
    expect(runtime.ensureCalls()).toBe(0)
  })
})

describe('ensureEmbeddingsVisibly', () => {
  it('resolves at once when the platform has no embedding runtime', async () => {
    setDefaultEmbeddingRuntime(
      createTestEmbeddingRuntimeService({ status: { status: 'unsupported' } }),
    )
    await expect(ensureEmbeddingsVisibly()).resolves.toEqual({ status: 'unsupported' })
  })

  it('resolves only at a terminal status (a racing ensure returns loading)', async () => {
    // Someone else is mid-download: ensure and the re-poll both answer loading.
    const runtime = createTestEmbeddingRuntimeService({ status: { status: 'loading' } })
    setDefaultEmbeddingRuntime(runtime)

    let settled = false
    const pending = ensureEmbeddingsVisibly().then((status) => {
      settled = true
      return status
    })
    await vi.waitFor(() => expect(runtime.ensureCalls()).toBe(1))
    expect(settled).toBe(false)

    runtime.setStatus({ status: 'ready', model: 'all-MiniLM-L6-v2' })
    await expect(pending).resolves.toEqual({ status: 'ready', model: 'all-MiniLM-L6-v2' })
  })

  it('returns a failed status when the load fails', async () => {
    setDefaultEmbeddingRuntime(
      createTestEmbeddingRuntimeService({ status: { status: 'failed', message: 'no disk space' } }),
    )
    const status = await ensureEmbeddingsVisibly()
    expect(status).toEqual({ status: 'failed', message: 'no disk space' })
  })
})
