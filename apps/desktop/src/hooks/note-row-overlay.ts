import { useCallback, useSyncExternalStore } from 'react'
import {
  defaultNoteRows,
  type NoteRow,
  type NoteRowOverlay,
  type NoteRowOverlayPatch,
} from '@reflect/core'

/*
 * The optimistic read overlay for note index rows lives in `@reflect/core`
 * (`NoteRowService`). Each function here delegates to the process-wide
 * service.
 */

export { applyNoteRowOverlay, type NoteRowOverlay, type NoteRowOverlayPatch } from '@reflect/core'

/** `defaultNoteRows().setOverlay`. */
export function setNoteRowOverlay(
  path: string,
  generation: number,
  patch: NoteRowOverlayPatch,
): void {
  defaultNoteRows().setOverlay(path, generation, patch)
}

/** `defaultNoteRows().getOverlay`. */
export function getNoteRowOverlay(
  path: string,
  generation: number | undefined,
): NoteRowOverlay | null {
  return defaultNoteRows().getOverlay(path, generation)
}

/** `defaultNoteRows().reconcile`. Call it from an effect, never during render. */
export function reconcileNoteRowOverlay(
  path: string,
  generation: number,
  row: NoteRow | null,
): void {
  defaultNoteRows().reconcile(path, generation, row)
}

/** `defaultNoteRows().reset`. */
export function resetNoteRowOverlays(): void {
  defaultNoteRows().reset()
}

/** Subscribe a component to `path`'s overlay on `generation`; `null` when none. */
export function useNoteRowOverlay(
  path: string,
  generation: number | undefined,
): NoteRowOverlay | null {
  const noteRows = defaultNoteRows()
  const subscribe = useCallback((listener: () => void) => noteRows.subscribe(listener), [noteRows])
  const getSnapshot = useCallback(
    () => noteRows.getOverlay(path, generation),
    [noteRows, path, generation],
  )
  return useSyncExternalStore(subscribe, getSnapshot)
}
