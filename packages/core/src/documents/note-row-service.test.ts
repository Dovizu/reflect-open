import { describe, expect, it, vi } from 'vitest'
import type { NoteRow } from '../indexing/index-query-service.ts'
import { applyNoteRowOverlay, createNoteRowService } from './note-row-service.ts'

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
