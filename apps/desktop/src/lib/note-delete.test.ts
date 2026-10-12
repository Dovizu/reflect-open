import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBridge } from '@reflect/core'
import type { NoteSession } from '@/editor/note-session.ts'
import { installTestOpenDocuments } from '@/test-utils/open-documents.ts'
import { deleteOpenNote } from './note-delete.ts'

const documents = installTestOpenDocuments()

const mockInvoke = vi.fn<(command: string, args: Record<string, unknown>) => Promise<unknown>>()

beforeEach(() => {
  setBridge({ invoke: mockInvoke, listen: async () => () => {} })
  mockInvoke.mockReset()
  mockInvoke.mockResolvedValue(null)
})

afterEach(() => {
  setBridge(null) // don't leak the mock transport into other suites in this worker
})

describe('deleteOpenNote', () => {
  it('discards a new note that has not reached disk without trying to trash a file', async () => {
    const discard = vi.fn()
    documents.open(
      {
        prepareDelete: async () => true,
        discard,
      } as unknown as NoteSession,
      'notes/new.md',
    )

    await deleteOpenNote('notes/new.md', 7)

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(discard).toHaveBeenCalledTimes(1)
  })

  it('trashes the file, then discards its open session so it cannot resurrect', async () => {
    const discard = vi.fn()
    documents.open(
      {
        prepareDelete: async () => false,
        discard,
      } as unknown as NoteSession,
      'notes/keep.md',
    )

    await deleteOpenNote('notes/keep.md', 7)

    expect(mockInvoke).toHaveBeenCalledWith('note_delete', { path: 'notes/keep.md', generation: 7 })
    // Discarded *after* the file is gone — otherwise a teardown flush could
    // re-create it. The mock invoke resolves before `discard` is reached.
    expect(discard).toHaveBeenCalledTimes(1)
  })

  it('trashes a note with no open session without error', async () => {
    await deleteOpenNote('notes/keep.md', 7)

    expect(mockInvoke).toHaveBeenCalledWith('note_delete', { path: 'notes/keep.md', generation: 7 })
  })

  it('resumes persistence when trashing a prepared session fails', async () => {
    const cancelDelete = vi.fn()
    const discard = vi.fn()
    documents.open(
      {
        prepareDelete: async () => false,
        cancelDelete,
        discard,
      } as unknown as NoteSession,
      'notes/keep.md',
    )
    mockInvoke.mockRejectedValue(new Error('disk full'))

    await expect(deleteOpenNote('notes/keep.md', 7)).rejects.toThrow('disk full')

    expect(cancelDelete).toHaveBeenCalledOnce()
    expect(discard).not.toHaveBeenCalled()
  })

  it('refuses to delete a daily note and never touches disk or sessions', async () => {
    const sessionFor = vi.spyOn(documents.service(), 'sessionFor')

    await expect(deleteOpenNote('daily/2026-06-15.md', 7)).rejects.toThrow(/daily/i)

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(sessionFor).not.toHaveBeenCalled()
  })
})
