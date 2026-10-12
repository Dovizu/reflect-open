import { defaultNoteActions, type NoteRow } from '@reflect/core'
import { queryKeys } from '@/lib/query-client.ts'
import type { NoteActionInput } from './notes/types.ts'

/** Toggle privacy with shared optimistic feedback and save-error reporting. Markdown owns the final state. */
export async function toggleNotePrivate(input: NoteActionInput): Promise<void> {
  const { queryClient, root, generation, path } = input
  const queryKey = queryKeys.index.note(root, path)
  const apply = (isPrivate: boolean): void => {
    queryClient.setQueryData<NoteRow | null>(queryKey, (row) => (row ? { ...row, isPrivate } : row))
  }
  let predicted = null as boolean | null
  const outcome = await defaultNoteActions().togglePrivate(path, generation, {
    // Runs once the service accepts the call, so a duplicate press changes nothing.
    prepare: async () => {
      await queryClient.cancelQueries({ queryKey, exact: true })
      const previous = queryClient.getQueryData<NoteRow | null>(queryKey)
      predicted = !(previous?.isPrivate ?? false)
      apply(predicted)
    },
  })
  if (outcome.status === 'failed') {
    void queryClient.invalidateQueries({ queryKey, exact: true })
    return
  }
  if (outcome.status === 'done' && outcome.isPrivate !== predicted) {
    apply(outcome.isPrivate)
  }
}
