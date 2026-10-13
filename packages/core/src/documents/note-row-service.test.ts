import { describe, expect, it, vi } from 'vitest'
import type { NoteRow, PinnedNote } from '../indexing/index-query-service.ts'
import {
  applyNoteRowOverlay,
  applyNoteRowOverlays,
  applyPinnedNoteOverlays,
  createNoteRowService,
} from './note-row-service.ts'

function noteRow(overrides: Partial<NoteRow> = {}): NoteRow {
  return {
    path: 'notes/a.md',
    title: 'A',
    dailyDate: null,
    isPrivate: false,
    hasConflict: false,
    gistUrl: null,
    gistStale: false,
    ...overrides,
  }
}

const URL = 'https://gist.github.com/alex/g1'
const GEN = 1

describe('applyNoteRowOverlay', () => {
  it('merges overlay fields over the row', () => {
    expect(
      applyNoteRowOverlay(noteRow({ gistStale: true }), {
        gistUrl: URL,
        gistStale: false,
      }),
    ).toMatchObject({
      gistUrl: URL,
      gistStale: false,
    })
  })

  it('passes a null row through: the overlay only sharpens an existing row', () => {
    expect(applyNoteRowOverlay(null, { gistUrl: URL })).toBeNull()
  })

  it('returns the same row reference when there is no overlay', () => {
    const row = noteRow({ gistUrl: 'kept' })
    expect(applyNoteRowOverlay(row, null)).toBe(row)
  })

  it('merges only the fields a note row has', () => {
    expect(
      applyNoteRowOverlay(noteRow(), { isPrivate: true, isPinned: true, trashed: true }),
    ).toEqual(noteRow({ isPrivate: true }))
  })
})

describe('applyNoteRowOverlays', () => {
  const rows = [
    { path: 'notes/a.md', isPinned: false },
    { path: 'notes/b.md', isPinned: false },
    { path: 'notes/c.md', isPinned: true },
  ]

  it('drops trashed rows and merges the fields each row has', () => {
    const overlays = new Map([
      ['notes/a.md', { isPinned: true, pinnedOrder: 1024, isPrivate: true }],
      ['notes/b.md', { trashed: true }],
    ])
    expect(applyNoteRowOverlays(rows, overlays)).toEqual([
      { path: 'notes/a.md', isPinned: true },
      { path: 'notes/c.md', isPinned: true },
    ])
  })

  it('returns the same array when nothing changes', () => {
    expect(applyNoteRowOverlays(rows, new Map())).toBe(rows)
    expect(applyNoteRowOverlays(rows, new Map([['notes/c.md', { isPinned: true }]]))).toBe(rows)
  })
})

describe('applyPinnedNoteOverlays', () => {
  function pinned(path: string, pinnedOrder: number | null): PinnedNote {
    return { path, title: path, dailyDate: null, pinnedOrder }
  }
  const preview = (path: string): PinnedNote => pinned(`preview:${path}`, null)
  const shelf = [pinned('a', 1024), pinned('b', 2048), pinned('c', null), pinned('d', null)]

  it('removes unpinned and trashed notes and moves reordered ones', () => {
    const overlays = new Map([
      ['a', { pinnedOrder: 3072 }],
      ['b', { isPinned: false }],
      ['c', { trashed: true }],
    ])
    expect(applyPinnedNoteOverlays(shelf, overlays, preview)).toEqual([
      pinned('a', 3072),
      pinned('d', null),
    ])
  })

  it('adds a new pin where its order sorts, and a bare pin last', () => {
    const overlays = new Map([
      ['x', { isPinned: true, pinnedOrder: 1536 }],
      ['y', { isPinned: true, pinnedOrder: null }],
    ])
    expect(
      applyPinnedNoteOverlays(shelf, overlays, preview).map((note) => [
        note.path,
        note.pinnedOrder,
      ]),
    ).toEqual([
      ['a', 1024],
      ['preview:x', 1536],
      ['b', 2048],
      ['c', null],
      ['d', null],
      ['preview:y', null],
    ])
  })

  it('returns the same shelf when nothing changes', () => {
    expect(applyPinnedNoteOverlays(shelf, new Map([['a', { isPinned: true }]]), preview)).toBe(
      shelf,
    )
  })
})

describe('setOverlay', () => {
  it('ignores an empty or all-undefined patch (no non-reconcilable entry)', () => {
    const noteRows = createNoteRowService()
    const listener = vi.fn()
    noteRows.subscribe(listener)
    noteRows.setOverlay('notes/a.md', GEN, {})
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: undefined })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
    expect(listener).not.toHaveBeenCalled()
  })

  it('scopes the overlay to the writing generation', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL })
    expect(noteRows.getOverlay('notes/a.md', GEN)?.gistUrl).toBe(URL)
    // A reader on a different graph generation never sees it.
    expect(noteRows.getOverlay('notes/a.md', GEN + 1)).toBeNull()
    expect(noteRows.getOverlay('notes/a.md', undefined)).toBeNull()
  })

  it('merges patches of the same generation', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL })
    noteRows.setOverlay('notes/a.md', GEN, { gistStale: false })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ gistUrl: URL, gistStale: false })
  })

  it('lets a newer generation replace an older overlay', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: 'old' })
    noteRows.setOverlay('notes/a.md', GEN + 1, { gistUrl: 'new' })
    expect(noteRows.getOverlay('notes/a.md', GEN + 1)?.gistUrl).toBe('new')
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
  })

  it('ignores an older generation late write, keeping the newer overlay', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN + 1, { gistUrl: 'new' })
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: 'stale' }) // older graph, resolved late
    expect(noteRows.getOverlay('notes/a.md', GEN + 1)?.gistUrl).toBe('new')
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
  })

  it('drops the pin order on an unpin and the trash mark on any other patch', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { isPinned: true, pinnedOrder: 1024 })
    noteRows.setOverlay('notes/a.md', GEN, { isPinned: false })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ isPinned: false })

    noteRows.setOverlay('notes/a.md', GEN, { trashed: true })
    noteRows.setOverlay('notes/a.md', GEN, { isPrivate: true })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ isPinned: false, isPrivate: true })
  })

  it('keeps the overlays of two services apart', () => {
    const first = createNoteRowService()
    const second = createNoteRowService()
    first.setOverlay('notes/a.md', GEN, { gistUrl: URL })
    expect(second.getOverlay('notes/a.md', GEN)).toBeNull()
  })
})

describe('reconcile', () => {
  it('holds the overlay while the index still lags, retires it once they agree', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL })

    noteRows.reconcile('notes/a.md', GEN, noteRow({ gistUrl: null }))
    expect(noteRows.getOverlay('notes/a.md', GEN)?.gistUrl).toBe(URL) // index hasn't caught up

    noteRows.reconcile('notes/a.md', GEN, noteRow({ gistUrl: URL }))
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull() // index agrees, retired
  })

  it('retires overlay fields independently as the index catches up', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL, gistStale: false })

    noteRows.reconcile('notes/a.md', GEN, noteRow({ gistUrl: URL, gistStale: true }))
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ gistStale: false })

    noteRows.reconcile('notes/a.md', GEN, noteRow({ gistUrl: URL, gistStale: false }))
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
  })

  it('holds the overlay against a null row (nothing to compare yet)', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL })
    noteRows.reconcile('notes/a.md', GEN, null)
    expect(noteRows.getOverlay('notes/a.md', GEN)?.gistUrl).toBe(URL)
  })

  it('holds an overlay whose generation does not match the reconciling read', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL })
    // A reconcile on a *different* generation can't retire this overlay, even
    // when the row's value matches, so a stale-graph read never drops it.
    noteRows.reconcile('notes/a.md', GEN + 1, noteRow({ gistUrl: URL }))
    expect(noteRows.getOverlay('notes/a.md', GEN)?.gistUrl).toBe(URL)
  })
})

describe('reconcile (pin, private, trash)', () => {
  it('retires pin fields only from a read that carries them', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { isPinned: true, pinnedOrder: 1024, isPrivate: true })

    noteRows.reconcile('notes/a.md', GEN, noteRow({ isPrivate: true }))
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ isPinned: true, pinnedOrder: 1024 })

    noteRows.reconcile('notes/a.md', GEN, { isPinned: true, pinnedOrder: 1024 })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
  })

  it('retires a trashed note once the index has no row for it', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { trashed: true })

    noteRows.reconcile('notes/a.md', GEN, noteRow())
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ trashed: true })

    noteRows.reconcile('notes/a.md', GEN, null)
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
  })
})

describe('reconcileRows', () => {
  it('reconciles each listed row and notifies once', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { isPinned: true })
    noteRows.setOverlay('notes/b.md', GEN, { isPinned: false })
    const listener = vi.fn()
    noteRows.subscribe(listener)

    noteRows.reconcileRows(GEN, [
      { path: 'notes/a.md', isPinned: true },
      { path: 'notes/b.md', isPinned: false },
    ])

    expect(noteRows.getOverlays(GEN).size).toBe(0)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('retires a trashed note missing from a complete list only', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { trashed: true })

    noteRows.reconcileRows(GEN, [{ path: 'notes/b.md' }])
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ trashed: true })
    noteRows.reconcileRows(GEN, [{ path: 'notes/a.md' }], { complete: true })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ trashed: true })

    noteRows.reconcileRows(GEN, [{ path: 'notes/b.md' }], { complete: true })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
  })
})

describe('dropOverlay', () => {
  it("drops only the fields that still hold the failed action's values", () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { pinnedOrder: 2048, gistUrl: URL })

    noteRows.dropOverlay('notes/a.md', GEN, { pinnedOrder: 1024 })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ pinnedOrder: 2048, gistUrl: URL })

    noteRows.dropOverlay('notes/a.md', GEN, { pinnedOrder: 2048 })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toEqual({ gistUrl: URL })

    noteRows.dropOverlay('notes/a.md', GEN, { gistUrl: URL })
    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
  })
})

describe('getOverlays', () => {
  it("returns the generation's overlays as a snapshot that changes only with them", () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { isPinned: true })
    noteRows.setOverlay('notes/b.md', GEN + 1, { isPinned: true })

    const snapshot = noteRows.getOverlays(GEN)
    expect([...snapshot]).toEqual([['notes/a.md', { isPinned: true }]])
    expect(noteRows.getOverlays(GEN)).toBe(snapshot)
    expect(noteRows.getOverlays(undefined).size).toBe(0)

    noteRows.setOverlay('notes/a.md', GEN, { isPrivate: true })
    expect(noteRows.getOverlays(GEN)).not.toBe(snapshot)
  })
})

describe('reset', () => {
  it('drops every overlay (e.g. on a graph switch) and notifies once', () => {
    const noteRows = createNoteRowService()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL })
    const listener = vi.fn()
    const unlisten = noteRows.subscribe(listener)

    noteRows.reset()
    noteRows.reset()

    expect(noteRows.getOverlay('notes/a.md', GEN)).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    unlisten()
    noteRows.setOverlay('notes/a.md', GEN, { gistUrl: URL })
    expect(listener).toHaveBeenCalledOnce()
  })
})
