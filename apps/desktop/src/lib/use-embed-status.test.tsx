import { afterEach, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { setDefaultEmbeddingRuntime } from '@reflect/core'
import {
  createTestEmbeddingRuntimeService,
  createTestIpcBridgeService,
  installTestBridge,
} from '@reflect/core/testing'
import { useEmbedStatus } from './use-embed-status.ts'

let removeBridge: () => void = () => {}

afterEach(() => {
  removeBridge()
  setDefaultEmbeddingRuntime(null)
})

it('starts a later mount from the last status an earlier mount received', async () => {
  removeBridge = installTestBridge(createTestIpcBridgeService())
  setDefaultEmbeddingRuntime(
    createTestEmbeddingRuntimeService({ status: { status: 'unsupported' } }),
  )
  const first = await renderHook(() => useEmbedStatus())
  await vi.waitFor(() => expect(first.result.current).toEqual({ status: 'unsupported' }))
  await first.unmount()

  const seen: string[] = []
  await renderHook(() => {
    const status = useEmbedStatus()
    seen.push(status.status)
    return status
  })

  expect(seen[0]).toBe('unsupported')
})

it('tracks status changes while mounted', async () => {
  removeBridge = installTestBridge(createTestIpcBridgeService())
  const runtime = createTestEmbeddingRuntimeService({ status: { status: 'loading' } })
  setDefaultEmbeddingRuntime(runtime)
  const view = await renderHook(() => useEmbedStatus())
  await vi.waitFor(() => expect(view.result.current).toEqual({ status: 'loading' }))

  runtime.setStatus({ status: 'ready', model: 'all-MiniLM-L6-v2' })
  await vi.waitFor(() =>
    expect(view.result.current).toEqual({ status: 'ready', model: 'all-MiniLM-L6-v2' }),
  )
})

it('stays uninitialized without a bridge', async () => {
  setDefaultEmbeddingRuntime(
    createTestEmbeddingRuntimeService({ status: { status: 'unsupported' } }),
  )
  const view = await renderHook(() => useEmbedStatus())
  expect(view.result.current).toEqual({ status: 'uninitialized' })
})
