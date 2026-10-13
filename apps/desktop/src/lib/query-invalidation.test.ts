import { afterEach, describe, expect, it } from 'vitest'
import {
  createTestAppServices,
  createTestAssetDescriptionService,
  createTestCaptureService,
} from '@reflect/core/testing'
import type { XPost } from '@post-embed/types'
import { createXPostResolver, xPostQueryOptions } from '@/editor/use-x-post-resolver.ts'
import { queryClient } from './query-client.ts'
import { installQueryInvalidation } from './query-invalidation.ts'

const app = { embedMedia: createTestAppServices().embedMedia }
const url = 'https://x.com/jack/status/123'
const post: XPost = {
  id: '123',
  createdAt: '2026-09-14T00:00:00Z',
  author: { name: 'Jack', handle: 'jack' },
  body: [{ type: 'text', text: 'Saved tweet' }],
}

function install(capture: ReturnType<typeof createTestCaptureService>): () => void {
  return installQueryInvalidation({
    capture,
    assetDescription: createTestAssetDescriptionService(),
  })
}

function cachePost(): void {
  queryClient.setQueryData(xPostQueryOptions(app, 3, '123').queryKey, post)
}

afterEach(() => {
  queryClient.clear()
})

describe('installQueryInvalidation', () => {
  it('re-reads cached X posts after a capture pass wrote X posts', async () => {
    cachePost()
    const capture = createTestCaptureService()
    const stop = install(capture)
    const resolveXPost = createXPostResolver(app, 3)
    expect(resolveXPost(url)).toBe(post)

    capture.emitXPostsWritten()

    const next = resolveXPost(url)
    expect(next).toBeInstanceOf(Promise)
    await Promise.resolve(next).catch(() => {})
    stop()
  })

  it('keeps cached X posts while no pass reports a write', () => {
    cachePost()
    const stop = install(createTestCaptureService())
    const resolveXPost = createXPostResolver(app, 3)

    expect(resolveXPost(url)).toBe(post)
    stop()
  })

  it('stops re-reading once unsubscribed', () => {
    cachePost()
    const capture = createTestCaptureService()
    install(capture)()
    const resolveXPost = createXPostResolver(app, 3)

    capture.emitXPostsWritten()

    expect(resolveXPost(url)).toBe(post)
  })
})
