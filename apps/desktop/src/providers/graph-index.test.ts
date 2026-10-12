import {
  createTestAppServices,
  createTestICloudNativeService,
  createTestIndexLifecycleService,
  createTestIndexStoreService,
  createTestNoteFileService,
  type TestICloudNativeService,
  type TestIndexLifecycleService,
} from '@reflect/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient, queryKeys } from '@/lib/query-client.ts'
import { bindGraphIndex } from './graph-index.ts'

// The lifecycle itself is covered in `@reflect/core`; these cover what the
// desktop app does with its events.

let icloud: TestICloudNativeService
let closeDatabase: () => void

beforeEach(() => {
  icloud = createTestICloudNativeService()
  closeDatabase = () => {}
})

afterEach(() => {
  closeDatabase()
})

/** Bind the app to `index`, over test doubles for the other services. */
function bind(index: TestIndexLifecycleService): () => void {
  const app = createTestAppServices({ indexLifecycle: index, icloudNative: icloud })
  closeDatabase = () => app.database.close()
  return bindGraphIndex(app)
}

/** A lifecycle whose first sync pass is a full rebuild over `notes/a.md` and the `evicted` notes. */
function setup(options?: { evicted?: string[] }) {
  const evicted = options?.evicted ?? []
  const index = createTestIndexLifecycleService({
    noteFile: createTestNoteFileService({
      files: {
        'notes/a.md': '# A',
        ...Object.fromEntries(evicted.map((path) => [path, '# Evicted'])),
      },
      evicted,
    }),
  })
  const unbind = bind(index)
  return { index, unbind }
}

describe('bindGraphIndex', () => {
  it('invalidates the index queries once a pass commits', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { index } = setup()

    index.sync(5, () => false)
    await index.settled()

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
  })

  it('invalidates the index queries after a requested rebuild', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { index } = setup()

    await index.rebuildVisibly(5)

    // A manual rebuild bypasses the watcher pipeline, whose batches refresh the caches.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
  })

  it('leaves the index queries alone after a failed rebuild', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const index = createTestIndexLifecycleService({
      indexStore: createTestIndexStoreService({
        fail: (call) => (call.method === 'clear' ? new Error('index on fire') : undefined),
      }),
    })
    const unbind = bind(index)

    await index.rebuildVisibly(5)

    expect(invalidate).not.toHaveBeenCalled()
    unbind()
  })

  it('requests downloads for the stale placeholders a pass reports', async () => {
    const { index } = setup({ evicted: ['notes/evicted.md'] })

    index.sync(5, () => false)
    await index.settled()

    expect(icloud.calls()).toContainEqual({
      method: 'requestDownloads',
      args: [['notes/evicted.md']],
    })
  })

  it('disconnects every listener when unbound', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { index, unbind } = setup({ evicted: ['notes/evicted.md'] })
    unbind()

    index.sync(5, () => false)
    await index.settled()

    expect(invalidate).not.toHaveBeenCalled()
    expect(icloud.calls()).toEqual([])
  })
})
