import {
  defaultNoteActions,
  getNextPinOrder,
  type AppServices,
  type FilteredSearchHit,
  type NoteListEntry,
  type NoteRow,
  type PinnedNote,
} from '@reflect/core'
import { queryKeys } from '@/lib/query-client.ts'
import {
  insertPinnedNote,
  invalidatePinnedNotesCache,
  pinnedNoteFor,
  updatePinnedNotesCache,
} from './notes/pinned-notes-cache.ts'
import type { NoteActionInput } from './notes/types.ts'

/** Toggle pin with shared optimistic feedback and save-error reporting. Markdown owns the final state. */
export async function toggleNotePinned(
  ctx: Pick<AppServices, 'noteActions'>,
  input: NoteActionInput,
): Promise<void> {
  await updatePin(ctx, input, 'toggle')
}

/** Remove a pin directionally, even when the cached shelf is stale. */
export async function unpinNote(
  ctx: Pick<AppServices, 'noteActions'>,
  input: NoteActionInput,
): Promise<void> {
  await updatePin(ctx, input, 'unpin')
}

function applyPinnedState(input: NoteActionInput, note: PinnedNote, isPinned: boolean): void {
  const { queryClient, root, path } = input
  updatePinnedNotesCache(queryClient, root, (current = []) => {
    if (!isPinned) {
      return current.filter((entry) => entry.path !== path)
    }
    return current.some((entry) => entry.path === path) ? current : insertPinnedNote(current, note)
  })
  queryClient.setQueriesData<NoteListEntry[]>(
    { queryKey: queryKeys.index.allNotes(root) },
    (rows) => rows?.map((row) => (row.path === path ? { ...row, isPinned } : row)),
  )
  queryClient.setQueriesData<FilteredSearchHit[]>(
    { queryKey: queryKeys.index.mobileAllNotes(root) },
    (rows) => rows?.map((row) => (row.path === path ? { ...row, isPinned } : row)),
  )
}

async function updatePin(
  ctx: Pick<AppServices, 'noteActions'>,
  input: NoteActionInput,
  kind: 'toggle' | 'unpin',
): Promise<void> {
  const { queryClient, root, generation, path } = input
  let feedback = null as { preview: PinnedNote; predicted: boolean } | null
  // Runs once the service accepts the call, so a duplicate press changes nothing.
  const prepare = async (): Promise<number | null> => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: queryKeys.index.pinnedNotes(root) }),
      queryClient.cancelQueries({ queryKey: queryKeys.index.allNotes(root) }),
      queryClient.cancelQueries({ queryKey: queryKeys.index.mobileAllNotes(root) }),
    ])
    const shelf = queryClient.getQueryData<PinnedNote[]>(queryKeys.index.pinnedNotes(root))
    const previous = shelf?.find((note) => note.path === path)
    const row = queryClient.getQueryData<NoteRow | null>(queryKeys.index.note(root, path))
    // A shelf that has never loaded can't say what the next order is. A bare
    // `pinned: true` still pins; the note sorts last until a reorder numbers it.
    const order = shelf === undefined ? null : getNextPinOrder(shelf)
    const preview = previous ?? { ...pinnedNoteFor(path, row ?? null), pinnedOrder: order }
    const predicted = kind === 'unpin' ? false : previous === undefined
    feedback = { preview, predicted }
    applyPinnedState(input, preview, predicted)
    return order
  }
  const actions = ctx.noteActions
  const outcome =
    kind === 'unpin'
      ? await actions.unpin(path, generation, {
          prepare: async () => {
            await prepare()
          },
        })
      : await actions.togglePinned(path, generation, { prepare })
  if (outcome.status === 'failed') {
    invalidatePinnedNotesCache(queryClient, root)
    void queryClient.invalidateQueries({ queryKey: queryKeys.index.allNotes(root) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.index.mobileAllNotes(root) })
    return
  }
  if (outcome.status === 'done' && feedback !== null && outcome.pinned !== feedback.predicted) {
    applyPinnedState(input, feedback.preview, outcome.pinned)
  }
}

export async function reorderPinnedNotes(
  notes: readonly PinnedNote[],
  generation: number,
): Promise<void> {
  await defaultNoteActions().reorderPinned(notes, generation)
}
