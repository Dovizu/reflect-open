import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { applyNoteRowOverlays, type NoteListRowFacts, type NoteRowOverlay } from '@reflect/core'
import { useGraph } from '@/providers/graph-provider.tsx'
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

/** Subscribe a component to every overlay on `generation`, by path. */
export function useNoteRowOverlays(
  generation: number | undefined,
): ReadonlyMap<string, NoteRowOverlay> {
  const { noteRows } = useAppServices()
  const subscribe = useCallback((listener: () => void) => noteRows.subscribe(listener), [noteRows])
  const getSnapshot = useCallback(() => noteRows.getOverlays(generation), [noteRows, generation])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export interface UseNoteRowsOptions {
  /**
   * The rows list every note a trashed note could be listed under, so a
   * trashed note missing from them is gone from the index.
   */
  complete?: boolean
}

/**
 * Listed index rows with the overlay merged over them: a trashed note leaves
 * the list and an overlay field the row type has takes the overlay's value.
 * The overlay retires as the rows catch up. `undefined` (still loading)
 * passes through.
 */
export function useNoteRows<Row extends NoteListRowFacts>(
  rows: readonly Row[] | undefined,
  options?: UseNoteRowsOptions,
): readonly Row[] | undefined {
  const { graph } = useGraph()
  const generation = graph?.generation
  const { noteRows } = useAppServices()
  const overlays = useNoteRowOverlays(generation)
  const complete = options?.complete ?? false

  // An effect, not a render-time mutation: the store is shared, and writing it
  // during render would tear other subscribers.
  useEffect(() => {
    if (generation !== undefined && rows !== undefined && overlays.size > 0) {
      noteRows.reconcileRows(generation, rows, { complete })
    }
  }, [noteRows, generation, rows, overlays, complete])

  return useMemo(
    () => (rows === undefined ? undefined : applyNoteRowOverlays(rows, overlays)),
    [rows, overlays],
  )
}
