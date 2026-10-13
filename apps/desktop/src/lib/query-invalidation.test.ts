import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTestAppServices,
  createTestAssetDescriptionService,
  createTestCaptureService,
  createTestIndexLifecycleService,
  createTestIndexStoreService,
  createTestWindowService,
  type TestAppServices,
} from '@reflect/core/testing'
import type { XPost } from '@post-embed/types'
import { createXPostResolver, xPostQueryOptions } from '@/editor/use-x-post-resolver.ts'
import { queryClient, queryKeys } from './query-client.ts'
import { installQueryInvalidation } from './query-invalidation.ts'

const app = { embedMedia: createTestAppServices().embedMedia }
const url = 'https://x.com/jack/status/123'
const post: XPost = {
  id: '123',
  createdAt: '2026-09-14T00:00:00Z',
  author: { name: 'Jack', handle: 'jack' },
  body: [{ type: 'text', text: 'Saved tweet' }],
}

let services: TestAppServices | null = null

/** Install over `app`, which the test ends with. */
function installApp(app: TestAppServices) {
  services = app
  const stop = installQueryInvalidation(app)
  return { app, stop }
}

function install(capture: ReturnType<typeof createTestCaptureService>): () => void {
  return installApp(
    createTestAppServices({ capture, assetDescription: createTestAssetDescriptionService() }),
  ).stop
}

function cachePost(): void {
  queryClient.setQueryData(xPostQueryOptions(app, '/graph', '123').queryKey, post)
}

afterEach(() => {
  vi.useRealTimers()
  queryClient.clear()
  services?.database.close()
  services = null
})

describe('installQueryInvalidation', () => {
  it('re-reads cached X posts after a capture pass wrote X posts', async () => {
    cachePost()
    const capture = createTestCaptureService()
    const stop = install(capture)
    const resolveXPost = createXPostResolver(app, '/graph')
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
    const resolveXPost = createXPostResolver(app, '/graph')

    expect(resolveXPost(url)).toBe(post)
    stop()
  })

  it('stops re-reading once unsubscribed', () => {
    cachePost()
    const capture = createTestCaptureService()
    install(capture)()
    const resolveXPost = createXPostResolver(app, '/graph')

    capture.emitXPostsWritten()

    expect(resolveXPost(url)).toBe(post)
  })
})

describe('installQueryInvalidation for the index and the graph', () => {
  it('invalidates the index queries once a pass commits and after a rebuild', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { app, stop } = installApp(createTestAppServices())

    app.indexLifecycle.emitApplied(null, 5)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
    invalidate.mockClear()

    await app.indexLifecycle.rebuildVisibly(5)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
    stop()
  })

  it('leaves the index queries alone after a failed rebuild', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const indexLifecycle = createTestIndexLifecycleService({
      indexStore: createTestIndexStoreService({
        fail: (call) => (call.method === 'clear' ? new Error('index on fire') : undefined),
      }),
    })
    const { stop } = installApp(createTestAppServices({ indexLifecycle }))

    await indexLifecycle.rebuildVisibly(5)

    expect(invalidate).not.toHaveBeenCalled()
    stop()
  })

  it('refreshes the chat history queries after a saved turn', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const listeners: Array<() => void> = []
    const app = createTestAppServices()
    vi.spyOn(app.chatSessions, 'onConversationsChanged').mockImplementation((listener) => {
      listeners.push(listener)
      return () => {}
    })
    const { stop } = installApp(app)

    for (const listener of listeners) {
      listener()
    }

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.chat.all })
    stop()
  })

  it('drops the similar notes on a graph switch and the iCloud listing on a delete', async () => {
    const { app, stop } = installApp(createTestAppServices())
    app.graphSession.setGraph({ root: '/known' })
    queryClient.setQueryData([...queryKeys.similar.all, '/known', 'notes/a.md'], [])
    queryClient.setQueryData(queryKeys.icloud.status, { available: true })

    await app.graphSession.openRecent('/other')
    expect(queryClient.getQueriesData({ queryKey: queryKeys.similar.all })).toEqual([])
    expect(queryClient.getQueryData(queryKeys.icloud.status)).toEqual({ available: true })

    queryClient.setQueryData([...queryKeys.similar.all, '/other', 'notes/a.md'], [])
    await app.graphSession.chooseGraph()
    expect(queryClient.getQueriesData({ queryKey: queryKeys.similar.all })).toHaveLength(1)

    await app.graphSession.openRecent('/other')
    await app.graphSession.deleteGraph()
    expect(queryClient.getQueryData(queryKeys.icloud.status)).toBeUndefined()
    stop()
  })

  it('drops the archived X posts whenever the graph session ends', async () => {
    const { app, stop } = installApp(createTestAppServices())
    app.graphSession.setGraph({ root: '/known' })
    cachePost()

    await app.graphSession.openRecent('/known')
    expect(queryClient.getQueriesData({ queryKey: queryKeys.xPost.all })).toEqual([])

    cachePost()
    await app.graphSession.chooseGraph()
    expect(queryClient.getQueriesData({ queryKey: queryKeys.xPost.all })).toEqual([])
    stop()
  })

  it('follows the index writes of the main window in a note window only', () => {
    // The throttle may hold the call until its window ends.
    vi.useFakeTimers()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const main = installApp(createTestAppServices())
    main.app.window.emitIndexWritten()
    expect(invalidate).not.toHaveBeenCalled()
    main.stop()
    main.app.database.close()

    const note = installApp(
      createTestAppServices({ window: createTestWindowService({ label: 'note-1' }) }),
    )
    note.app.window.emitIndexWritten()
    vi.advanceTimersByTime(3_000)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
    note.stop()
  })
})
