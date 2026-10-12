import { useCallback, useSyncExternalStore } from 'react'
import type { NoteRowOverlay } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/*
 * The optimistic read overlay for note index rows lives in `@reflect/core`
 * (`NoteRowService`); this module is its React view.
 */

export { applyNoteRowOverlay, type NoteRowOverlay, type NoteRowOverlayPatch } from '@reflect/core'

/** Subscribe a component to `path`'s overlay on `generation`; `null` when none. */
export function useNoteRowOverlay(
  path: string,
  generation: number | undefined,
): NoteRowOverlay | null {
  const { noteRows } = useAppServices()
  const subscribe = useCallback((listener: () => void) => noteRows.subscribe(listener), [noteRows])
  const getSnapshot = useCallback(
    () => noteRows.getOverlay(path, generation),
    [noteRows, path, generation],
  )
  return useSyncExternalStore(subscribe, getSnapshot)
}
