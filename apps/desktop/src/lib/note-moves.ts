import { defaultNoteMove, type NoteMovedListener } from '@reflect/core'

/*
 * The fan-out for note file moves lives in `@reflect/core`
 * (`NoteMoveService`). Each function here delegates to the process-wide
 * service.
 */

export type { NoteMovedListener }

/** Subscribe to note moves; returns the unsubscribe. */
export function onNoteMoved(listener: NoteMovedListener): () => void {
  return defaultNoteMove().onMoved(listener)
}

/**
 * Announce a landed move to every subscriber, as a move the index healed:
 * a live session at `from` is carried to `to` first.
 */
export function emitNoteMoved(from: string, to: string): void {
  defaultNoteMove().followHealedMove(from, to)
}
