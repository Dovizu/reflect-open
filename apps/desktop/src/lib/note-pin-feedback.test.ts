import {
  createTestAppServices,
  createTestOperationsService,
  type TestOperationsService,
} from '@reflect/core/testing'
import {
  isOstensiblyEmptyNoteSource,
  type AppServices,
  type FilteredSearchHit,
  type NoteDocumentService,
  type NoteListEntry,
  type PinnedNote,
} from '@reflect/core'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/lib/query-client.ts'
import { toggleNotePinned, unpinNote } from '@/lib/note-pin.ts'

const readNoteSource = vi.fn<NoteDocumentService['readSource']>()
const commitNoteFrontmatter = vi.fn<NoteDocumentService['commitFrontmatter']>()

let app: AppServices
let closeDatabase: () => void
let operations: TestOperationsService

beforeEach(() => {
  readNoteSource.mockReset().mockResolvedValue('# A\n')
  commitNoteFrontmatter.mockReset().mockResolvedValue(undefined)
  operations = createTestOperationsService()
  const services = createTestAppServices({
    operations,
    noteDocuments: {
      readSource: readNoteSource,
      readExisting: async (path) => await readNoteSource(path),
      commitFrontmatter: commitNoteFrontmatter,
      commitSourceEdit: () => Promise.reject(new Error('commitSourceEdit is not stubbed')),
      isOstensiblyEmpty: isOstensiblyEmptyNoteSource,
    },
  })
  closeDatabase = () => services.database.close()
  app = services
})

afterEach(() => {
  closeDatabase()
})

function setup() {
  const queryClient = new QueryClient()
  const input = {
    queryClient,
    root: '/g',
    generation: 7,
    path: 'notes/a.md',
  }
  const shelfKey = queryKeys.index.pinnedNotes('/g')
  const desktopKey = queryKeys.index.allNotesWithTag('/g', null)
  const mobileKey = queryKeys.index.mobileAllNotesWithSearch('/g', { text: '' })
  const note: PinnedNote = { path: input.path, title: 'a', dailyDate: null, pinnedOrder: 1024 }
  queryClient.setQueryData<PinnedNote[]>(shelfKey, [])
  queryClient.setQueryData<NoteListEntry[]>(desktopKey, [
    { path: input.path, title: 'A', snippet: '', tags: [], mtime: 0, isPinned: false },
  ])
  queryClient.setQueryData<FilteredSearchHit[]>(mobileKey, [
    {
      path: input.path,
      title: 'A',
      highlightedTitle: 'A',
      dailyDate: null,
      snippet: null,
      preview: '',
      mtime: 0,
      isPinned: false,
    },
  ])
  return { input, queryClient, shelfKey, desktopKey, mobileKey, note }
}

describe('pin feedback', () => {
  it('updates the shelf and existing list markers before persistence resolves', async () => {
    const { input, queryClient, shelfKey, desktopKey, mobileKey, note } = setup()
    const write = Promise.withResolvers<void>()
    commitNoteFrontmatter.mockReturnValueOnce(write.promise)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    const action = toggleNotePinned(app, input)
    await vi.waitFor(() => expect(commitNoteFrontmatter).toHaveBeenCalledTimes(1))
    expect(queryClient.getQueryData(shelfKey)).toEqual([note])
    expect(queryClient.getQueryData<NoteListEntry[]>(desktopKey)?.[0]?.isPinned).toBe(true)
    expect(queryClient.getQueryData<FilteredSearchHit[]>(mobileKey)?.[0]?.isPinned).toBe(true)
    expect(commitNoteFrontmatter).toHaveBeenCalledWith(input.path, { pinned: 1024 }, 7)

    // A second entrypoint in this window must not issue a competing write.
    await toggleNotePinned(app, input)
    expect(commitNoteFrontmatter).toHaveBeenCalledTimes(1)
    write.resolve()
    await action
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('cancels old shelf and list requests before applying optimistic pin feedback', async () => {
    const { input, queryClient, shelfKey, desktopKey, mobileKey } = setup()
    const stale = [shelfKey, desktopKey, mobileKey].map((queryKey) => {
      const oldData = queryClient.getQueryData(queryKey)
      const response = Promise.withResolvers<unknown>()
      const fetch = queryClient
        .fetchQuery({ queryKey, queryFn: () => response.promise })
        .catch(() => null)
      return { response, fetch, oldData }
    })
    const write = Promise.withResolvers<void>()
    commitNoteFrontmatter.mockReturnValueOnce(write.promise)
    const action = toggleNotePinned(app, input)
    await vi.waitFor(() => expect(commitNoteFrontmatter).toHaveBeenCalledOnce())
    for (const request of stale) {
      request.response.resolve(request.oldData)
      await request.fetch
    }
    expect(queryClient.getQueryData<PinnedNote[]>(shelfKey)?.[0]?.path).toBe(input.path)
    expect(queryClient.getQueryData<NoteListEntry[]>(desktopKey)?.[0]?.isPinned).toBe(true)
    expect(queryClient.getQueryData<FilteredSearchHit[]>(mobileKey)?.[0]?.isPinned).toBe(true)
    write.resolve()
    await action
  })

  it('corrects a stale cache prediction from the file result', async () => {
    const { input, queryClient, shelfKey, mobileKey } = setup()
    readNoteSource.mockResolvedValueOnce('---\npinned: true\n---\n# A\n')
    await toggleNotePinned(app, input)
    expect(queryClient.getQueryData(shelfKey)).toEqual([])
    expect(queryClient.getQueryData<FilteredSearchHit[]>(mobileKey)?.[0]?.isPinned).toBe(false)
  })

  it('keeps explicit unpin directional even if the shelf is already empty', async () => {
    const { input, queryClient, shelfKey } = setup()
    await unpinNote(app, input)
    expect(commitNoteFrontmatter).toHaveBeenCalledWith(input.path, { pinned: false }, 7)
    expect(readNoteSource).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(shelfKey)).toEqual([])
  })

  it('reconciles affected queries and reports a failed write once, allowing retry', async () => {
    const { input, queryClient, shelfKey, desktopKey, mobileKey } = setup()
    commitNoteFrontmatter.mockRejectedValueOnce(new Error('disk full'))
    await toggleNotePinned(app, input)
    for (const key of [shelfKey, desktopKey, mobileKey]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    }
    expect(operations.snapshot()).toMatchObject([
      { label: 'Updating pin', status: 'failed', message: 'disk full' },
    ])
    await toggleNotePinned(app, input)
    expect(commitNoteFrontmatter).toHaveBeenCalledTimes(2)
  })

  it('does not patch another graph or create uncached list queries', async () => {
    const { input, queryClient, note } = setup()
    const otherKey = queryKeys.index.pinnedNotes('/other')
    queryClient.setQueryData(otherKey, [note])
    await toggleNotePinned(app, input)
    expect(queryClient.getQueryData(otherKey)).toEqual([note])
    expect(
      queryClient.getQueryData(queryKeys.index.allNotesWithTag('/g', 'uncached')),
    ).toBeUndefined()
  })
})
