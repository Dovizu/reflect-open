import { defaultNoteMove } from '@reflect/core'

/*
 * Note moves live in `@reflect/core` (`NoteMoveService`). Each function here
 * delegates to the process-wide service.
 */

/** Move a note's file + projection, carrying any live editor session along (Plan 17). */
export async function moveNoteCarryingSession(
  from: string,
  to: string,
  generation: number,
): Promise<void> {
  await defaultNoteMove().moveNote(from, to, generation)
}

/** Follow a move the index healed by id (Plan 17). */
export function followHealedMove(from: string, to: string): void {
  defaultNoteMove().followHealedMove(from, to)
}
