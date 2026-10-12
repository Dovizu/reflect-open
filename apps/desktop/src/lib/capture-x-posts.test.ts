import { afterEach, describe, expect, it } from 'vitest'
import { createTestCaptureService, createTestEmbedMediaService } from '@reflect/core/testing'
import type { XPost } from '@post-embed/types'
import { createXPostResolver, xPostQueryOptions } from '@/editor/use-x-post-resolver.ts'
import { watchCaptureXPosts } from './capture-x-posts.ts'
import { queryClient } from './query-client.ts'

const app = { embedMedia: createTestEmbedMediaService() }
const url = 'https://x.com/jack/status/123'
const post: XPost = {
  id: '123',
  createdAt: '2026-09-14T00:00:00Z',
  author: { name: 'Jack', handle: 'jack' },
  body: [{ type: 'text', text: 'Saved tweet' }],
}

function cachePost(): void {
  queryClient.setQueryData(xPostQueryOptions(app, 3, '123').queryKey, post)
}

afterEach(() => {
  queryClient.clear()
})

describe('watchCaptureXPosts', () => {
  it('re-reads cached X posts after a capture pass wrote X posts', async () => {
    cachePost()
    const capture = createTestCaptureService()
    const stop = watchCaptureXPosts(capture)
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
    const stop = watchCaptureXPosts(createTestCaptureService())
    const resolveXPost = createXPostResolver(app, 3)

    expect(resolveXPost(url)).toBe(post)
    stop()
  })

  it('stops re-reading once unsubscribed', () => {
    cachePost()
    const capture = createTestCaptureService()
    watchCaptureXPosts(capture)()
    const resolveXPost = createXPostResolver(app, 3)

    capture.emitXPostsWritten()

    expect(resolveXPost(url)).toBe(post)
  })
})
