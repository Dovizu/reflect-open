import { setDefaultICloudNative } from '@reflect/core'
import {
  createTestICloudNativeService,
  createTestIndexLifecycleService,
  createTestNoteFileService,
  type TestICloudNativeService,
} from '@reflect/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient, queryKeys } from '@/lib/query-client.ts'
import { bindGraphIndex } from './graph-index.ts'

// The lifecycle itself is covered in `@reflect/core`; these cover what the
// desktop app does with its events.

let icloud: TestICloudNativeService

beforeEach(() => {
  icloud = createTestICloudNativeService()
  setDefaultICloudNative(icloud)
})

afterEach(() => {
  setDefaultICloudNative(null)
  vi.restoreAllMocks()
})

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
  const indexing: boolean[] = []
  let suspended = false
  const unbind = bindGraphIndex(index, {
    onIndexingChange: (value) => {
      indexing.push(value)
    },
    shouldSuspend: () => suspended,
  })
  return {
    index,
    indexing,
    unbind,
    setSuspended: (value: boolean) => {
      suspended = value
    },
  }
}

describe('bindGraphIndex', () => {
  it('reports indexing while a pass reconciles and invalidates once it commits', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { index, indexing } = setup()

    index.sync(5, () => false)
    expect(indexing).toEqual([true])
    await index.settled()

    expect(indexing).toEqual([true, false])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
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

  it('installs the suspend guard: no pass starts while it holds', async () => {
    const { index, indexing, setSuspended } = setup()
    setSuspended(true)

    index.sync(5, () => false)
    await index.settled()
    expect(indexing).toEqual([])

    setSuspended(false)
    index.sync(5, () => false)
    await index.settled()
    expect(indexing).toEqual([true, false])
  })

  it('disconnects every listener and the guard when unbound', async () => {
    const { index, indexing, unbind, setSuspended } = setup({
      evicted: ['notes/evicted.md'],
    })
    unbind()
    setSuspended(true) // the removed guard no longer holds the pass back

    index.sync(5, () => false)
    await index.settled()

    expect(indexing).toEqual([])
    expect(icloud.calls()).toEqual([])
  })
})
