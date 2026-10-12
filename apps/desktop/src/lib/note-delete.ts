import type { AppServices } from '@reflect/core'

/**
 * Delete an open regular note and detach its editor session without flushing:
 * `NoteActionsService.trash`, rejecting with the cause when the note could not
 * be trashed.
 */
export async function deleteOpenNote(
  ctx: Pick<AppServices, 'noteActions'>,
  path: string,
  generation: number,
): Promise<void> {
  const { failed } = await ctx.noteActions.trash(path, generation)
  const failure = failed[0]
  if (failure !== undefined) {
    throw failure.cause
  }
}
