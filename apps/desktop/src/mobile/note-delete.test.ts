import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNoteSessionService,
  setDefaultOpenDocuments,
  type NoteFileService,
  type NoteSession,
  type NoteSessionSnapshot,
  type OpenDocumentsService,
} from '@reflect/core'
import {
  createTestClockService,
  createTestLoggerService,
  createTestNoteFileService,
  createTestNoteSession,
  createTestOpenDocumentsService,
} from '@reflect/core/testing'
import { deleteOpenNote } from './note-delete.ts'

/**
 * `deleteOpenNote` discards an unpersisted note locally. Persisted notes are
 * deleted first, then their session is discarded — so a failed delete never
 * leaves a discarded-but-mounted session (which would silently stop
 * persisting the user's edits).
 */

const deleteNoteMock = vi.fn<(path: string, generation: number) => Promise<void>>()
const isDailyMock = vi.fn<(path: string) => boolean>()

vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  deleteNote: (path: string, generation: number) => deleteNoteMock(path, generation),
  isDaily: (path: string) => isDailyMock(path),
}))

let openDocuments: OpenDocumentsService

beforeEach(() => {
  openDocuments = createTestOpenDocumentsService()
  setDefaultOpenDocuments(openDocuments)
})

afterEach(() => {
  setDefaultOpenDocuments(null)
  deleteNoteMock.mockReset()
  isDailyMock.mockReset().mockReturnValue(false)
})

/** A session of a note with no file yet; `beforeWrite` runs before each write lands. */
function lazySession(beforeWrite: () => Promise<void>): {
  readonly session: NoteSession
  readonly snapshots: NoteSessionSnapshot[]
} {
  const snapshots: NoteSessionSnapshot[] = []
  const files = createTestNoteFileService()
  const noteFile: NoteFileService = {
    ...files,
    write: async (...args) => {
      await beforeWrite()
      return await files.write(...args)
    },
  }
  const session = createNoteSessionService({
    noteFile,
    clock: createTestClockService(),
    logger: createTestLoggerService(),
  }).create({
    path: 'notes/new.md',
    generation: () => 3,
    classify: () => 'exact',
    onSnapshot: (snapshot) => {
      snapshots.push(snapshot)
    },
    applyContent: () => {},
    createIfMissing: true,
    missingSeed: '#\n',
    saveDebounceMs: 10,
  })
  openDocuments.register({ session })
  return { session, snapshots }
}

describe('deleteOpenNote', () => {
  it('waits for a new note to load, then discards it without deleting a missing file', async () => {
    const { session } = lazySession(async () => {})
    const discardSpy = vi.spyOn(session, 'discard')
    session.load()

    await deleteOpenNote('notes/new.md', 3)

    expect(deleteNoteMock).not.toHaveBeenCalled()
    expect(discardSpy).toHaveBeenCalledOnce()
  })

  it("waits for a new note's in-flight first write before deleting its file", async () => {
    const writeStarted = Promise.withResolvers<void>()
    const allowWrite = Promise.withResolvers<void>()
    let fileExists = false
    const { session, snapshots } = lazySession(async () => {
      writeStarted.resolve()
      await allowWrite.promise
      fileExists = true
    })
    deleteNoteMock.mockImplementation(async () => {
      if (!fileExists) {
        throw new Error('no such file or directory')
      }
      fileExists = false
    })
    session.load()
    await vi.waitFor(() => expect(snapshots.at(-1)?.status).toBe('ready'))
    session.editorChanged('# Draft\n')
    const flush = session.flush()
    await writeStarted.promise

    const deletion = deleteOpenNote('notes/new.md', 3)
    await Promise.resolve()
    expect(deleteNoteMock).not.toHaveBeenCalled()

    allowWrite.resolve()
    await Promise.all([flush, deletion])

    expect(deleteNoteMock).toHaveBeenCalledWith('notes/new.md', 3)
    expect(fileExists).toBe(false)
  })

  it('discards the open session after a successful delete', async () => {
    deleteNoteMock.mockResolvedValue()
    const session = createTestNoteSession({ path: 'notes/gone.md' })
    openDocuments.register({ session })

    await deleteOpenNote('notes/gone.md', 3)

    expect(deleteNoteMock).toHaveBeenCalledWith('notes/gone.md', 3)
    expect(session.getCalls('discard')).toHaveLength(1)
  })

  it('leaves the session intact when the delete fails', async () => {
    deleteNoteMock.mockRejectedValue(new Error('disk full'))
    const session = createTestNoteSession({ path: 'notes/gone.md' })
    openDocuments.register({ session })
    const sessionFor = vi.spyOn(openDocuments, 'sessionFor')

    await expect(deleteOpenNote('notes/gone.md', 3)).rejects.toThrow('disk full')

    // The session was never discarded — the screen stays editable.
    expect(session.getCalls('discard')).toEqual([])
    expect(session.getCalls('cancelDelete')).toHaveLength(1)
    expect(sessionFor).toHaveBeenCalledOnce()
  })

  it('rejects daily notes without touching disk', async () => {
    isDailyMock.mockReturnValue(true)
    const sessionFor = vi.spyOn(openDocuments, 'sessionFor')

    await expect(deleteOpenNote('daily/2026-06-10.md', 3)).rejects.toThrow(
      'Daily notes cannot be deleted',
    )

    expect(deleteNoteMock).not.toHaveBeenCalled()
    expect(sessionFor).not.toHaveBeenCalled()
  })
})
