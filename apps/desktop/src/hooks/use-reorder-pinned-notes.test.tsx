import { QueryClient, useQuery } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { NoteActionsService, NotePinOrderWrite, PinnedNote } from '@reflect/core'
import {
  createTestAppServices,
  type TestAppServices,
  type TestOpenGraph,
} from '@reflect/core/testing'
import { queryKeys } from '@/lib/query-client.ts'
import { renderHookInApp } from '@/test-utils/render-in-app.tsx'
import { useReorderPinnedNotes } from './use-reorder-pinned-notes.ts'

const GRAPH: TestOpenGraph = { generation: 7, root: '/graphs/personal' }

let app: TestAppServices
let reorderPinnedNotes: MockInstance<NoteActionsService['reorderPinned']>

const NOTE_A = { dailyDate: null, path: 'a.md', title: 'A', pinnedOrder: 1024 } satisfies PinnedNote
const NOTE_B = { dailyDate: null, path: 'b.md', title: 'B', pinnedOrder: 2048 } satisfies PinnedNote
const NOTE_C = { dailyDate: null, path: 'c.md', title: 'C', pinnedOrder: 3072 } satisfies PinnedNote
const NOTES = [NOTE_A, NOTE_B, NOTE_C] as const
// A dropped between two neighbours takes the midpoint; dropped last it opens a
// fresh gap past the note it landed behind.
const FIRST_ORDER = [NOTE_B, { ...NOTE_A, pinnedOrder: 2560 }, NOTE_C]
const SECOND_ORDER = [NOTE_B, NOTE_C, { ...NOTE_A, pinnedOrder: 4096 }]
const THIRD_ORDER = [NOTE_C, { ...NOTE_A, pinnedOrder: 4096 }, { ...NOTE_B, pinnedOrder: 5120 }]

let queryClient: QueryClient

function renderReorder(pinned: readonly PinnedNote[] = NOTES) {
  return renderHookInApp(
    (
      { pinned }: { pinned: readonly PinnedNote[] } = {
        pinned: NOTES,
      },
    ) => useReorderPinnedNotes(pinned),
    { initialProps: { pinned }, app, graph: GRAPH, queryClient },
  )
}

beforeEach(() => {
  app = createTestAppServices()
  reorderPinnedNotes = vi.spyOn(app.noteActions, 'reorderPinned').mockResolvedValue([])
  queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Infinity },
    },
  })
  queryClient.setQueryData(queryKeys.index.pinnedNotes('/graphs/personal'), NOTES)
})

describe('useReorderPinnedNotes', () => {
  it('does nothing for a missing graph, missing note, or unchanged position', async () => {
    const hook = await renderReorder()

    await hook.act(() => hook.result.current('missing.md', 'b.md'))
    await hook.act(() => hook.result.current('a.md', 'a.md'))
    await hook.act(() => app.graphSession.setGraph(null))
    await hook.act(() => hook.result.current('a.md', 'b.md'))

    expect(reorderPinnedNotes).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(queryKeys.index.pinnedNotes('/graphs/personal'))).toEqual(NOTES)
  })

  it('updates optimistically and serializes disk writes after an earlier failure', async () => {
    const first = Promise.withResolvers<NotePinOrderWrite[]>()
    const second = Promise.withResolvers<NotePinOrderWrite[]>()
    const third = Promise.withResolvers<NotePinOrderWrite[]>()
    reorderPinnedNotes
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
      .mockImplementationOnce(() => third.promise)
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const hook = await renderReorder()

    await hook.act(() => hook.result.current('a.md', 'b.md'))
    expect(queryClient.getQueryData(queryKeys.index.pinnedNotes('/graphs/personal'))).toEqual(
      FIRST_ORDER,
    )
    await hook.rerender({ pinned: FIRST_ORDER })
    await hook.act(() => hook.result.current('a.md', 'c.md'))
    expect(queryClient.getQueryData(queryKeys.index.pinnedNotes('/graphs/personal'))).toEqual(
      SECOND_ORDER,
    )
    await hook.rerender({ pinned: SECOND_ORDER })
    await hook.act(() => hook.result.current('b.md', 'a.md'))
    expect(queryClient.getQueryData(queryKeys.index.pinnedNotes('/graphs/personal'))).toEqual(
      THIRD_ORDER,
    )
    expect(reorderPinnedNotes).toHaveBeenCalledTimes(1)

    first.resolve([])
    await vi.waitFor(() => expect(reorderPinnedNotes).toHaveBeenCalledTimes(2))
    second.reject(new Error('second write failed'))
    await vi.waitFor(() => expect(reorderPinnedNotes).toHaveBeenCalledTimes(3))
    third.resolve([])
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0))

    expect(reorderPinnedNotes.mock.calls).toEqual([
      [[{ ...NOTE_A, pinnedOrder: 2560 }], 7],
      [[{ ...NOTE_A, pinnedOrder: 4096 }], 7],
      [[{ ...NOTE_B, pinnedOrder: 5120 }], 7],
    ])
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(queryKeys.index.pinnedNotes('/graphs/personal'))).toEqual(
      THIRD_ORDER,
    )
  })

  it('renumbers the whole shelf when a neighbour carries no order', async () => {
    const bare = [
      { dailyDate: null, path: 'a.md', title: 'A' },
      { dailyDate: null, path: 'b.md', title: 'B' },
    ] satisfies PinnedNote[]
    queryClient.setQueryData(queryKeys.index.pinnedNotes('/graphs/personal'), bare)
    const hook = await renderReorder(bare)

    await hook.act(() => hook.result.current('a.md', 'b.md'))

    expect(reorderPinnedNotes).toHaveBeenCalledExactlyOnceWith(
      [
        { ...bare[1], pinnedOrder: 1024 },
        { ...bare[0], pinnedOrder: 2048 },
      ],
      7,
    )
  })

  it('refetches disk truth when the last outstanding reorder fails', async () => {
    const diskTruth = [NOTE_A, NOTE_C, NOTE_B]
    const readPinnedNotes = vi.fn<() => Promise<PinnedNote[]>>().mockResolvedValue(diskTruth)
    reorderPinnedNotes.mockRejectedValue(new Error('write failed'))
    const hook = await renderHookInApp(
      () => {
        useQuery({
          queryFn: readPinnedNotes,
          queryKey: queryKeys.index.pinnedNotes('/graphs/personal'),
        })
        return useReorderPinnedNotes(NOTES)
      },
      { app, graph: GRAPH, queryClient },
    )

    await hook.act(() => hook.result.current('a.md', 'b.md'))
    await vi.waitFor(() => expect(readPinnedNotes).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.index.pinnedNotes('/graphs/personal'))).toEqual(
        diskTruth,
      ),
    )
  })
})
