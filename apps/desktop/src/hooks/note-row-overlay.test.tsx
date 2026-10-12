import { act } from 'react'
import { renderHook } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NoteRow } from '@reflect/core'
import {
  reconcileNoteRowOverlay,
  resetNoteRowOverlays,
  setNoteRowOverlay,
  useNoteRowOverlay,
} from './note-row-overlay.ts'

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

beforeEach(() => {
  resetNoteRowOverlays()
})
afterEach(() => {
  resetNoteRowOverlays()
})

describe('useNoteRowOverlay', () => {
  it('reflects a set overlay and scopes it to the path', async () => {
    const { result } = await renderHook(() => useNoteRowOverlay('notes/a.md', GEN))
    const other = await renderHook(() => useNoteRowOverlay('notes/b.md', GEN))
    expect(result.current).toBeNull()

    act(() => setNoteRowOverlay('notes/a.md', GEN, { gistUrl: URL }))
    expect(result.current?.gistUrl).toBe(URL)
    expect(other.result.current).toBeNull()
  })

  it('retires overlay fields independently as the index catches up', async () => {
    const { result } = await renderHook(() => useNoteRowOverlay('notes/a.md', GEN))
    act(() => setNoteRowOverlay('notes/a.md', GEN, { gistUrl: URL, gistStale: false }))

    act(() =>
      reconcileNoteRowOverlay('notes/a.md', GEN, noteRow({ gistUrl: URL, gistStale: true })),
    )
    expect(result.current).toEqual({ gistStale: false })

    act(() =>
      reconcileNoteRowOverlay('notes/a.md', GEN, noteRow({ gistUrl: URL, gistStale: false })),
    )
    expect(result.current).toBeNull()
  })
})

describe('reconcileNoteRowOverlay', () => {
  it('holds the overlay while the index still lags, retires it once they agree', async () => {
    const { result } = await renderHook(() => useNoteRowOverlay('notes/a.md', GEN))
    act(() => setNoteRowOverlay('notes/a.md', GEN, { gistUrl: URL }))

    act(() => reconcileNoteRowOverlay('notes/a.md', GEN, noteRow({ gistUrl: null })))
    expect(result.current?.gistUrl).toBe(URL) // index hasn't caught up

    act(() => reconcileNoteRowOverlay('notes/a.md', GEN, noteRow({ gistUrl: URL })))
    expect(result.current).toBeNull() // index agrees → retired
  })

  it('holds the overlay against a null row (nothing to compare yet)', async () => {
    const { result } = await renderHook(() => useNoteRowOverlay('notes/a.md', GEN))
    act(() => setNoteRowOverlay('notes/a.md', GEN, { gistUrl: URL }))
    act(() => reconcileNoteRowOverlay('notes/a.md', GEN, null))
    expect(result.current?.gistUrl).toBe(URL)
  })
})

describe('resetNoteRowOverlays', () => {
  it('drops every overlay (e.g. on a graph switch)', async () => {
    const { result } = await renderHook(() => useNoteRowOverlay('notes/a.md', GEN))
    act(() => setNoteRowOverlay('notes/a.md', GEN, { gistUrl: URL }))
    expect(result.current?.gistUrl).toBe(URL)

    act(() => resetNoteRowOverlays())
    expect(result.current).toBeNull()
  })
})
