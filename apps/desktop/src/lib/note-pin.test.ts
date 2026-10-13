import {
  createTestAppServices,
  createTestNoteFileService,
  createTestOperationsService,
  type TestOperationsService,
} from '@reflect/core/testing'
import type { AppServices, NoteFileService, OpenDocumentsService } from '@reflect/core'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { NoteSession } from '@/editor/note-session.ts'
import { queryKeys } from '@/lib/query-client.ts'
import { toggleNotePinned, unpinNote } from './note-pin.ts'

let client: QueryClient

function input(path = 'notes/a.md') {
  return { queryClient: client, root: '/g', generation: 3, path }
}

let app: AppServices
let closeDatabase: () => void
let operations: TestOperationsService
let openDocuments: OpenDocumentsService
let read: MockInstance<NoteFileService['read']>
let write: MockInstance<NoteFileService['write']>

/** The spies on the note files of the running test. */
const noteFile = { read: () => read, write: () => write }

/** Register `session` as an open document; a stand-in without a `path` gets `path`. */
const documents = {
  open(session: Partial<NoteSession>, path = 'notes/a.md'): () => void {
    const target = session.path === undefined ? Object.assign(session, { path }) : session
    // A stand-in implements only what the code under test calls.
    return openDocuments.register({ session: target as NoteSession })
  },
}

beforeEach(() => {
  const files = createTestNoteFileService()
  read = vi.spyOn(files, 'read')
  write = vi.spyOn(files, 'write')
  operations = createTestOperationsService()
  client = new QueryClient()
  const services = createTestAppServices({ noteFile: files, operations })
  openDocuments = services.openDocuments
  closeDatabase = () => services.database.close()
  app = services
})

afterEach(() => {
  closeDatabase()
})

function fakeSession(content: string, canCommit = true, liveContent: string | null = content) {
  const commitFrontmatter = vi.fn(async () => canCommit)
  const session = {
    content: () => content,
    liveContent: () => liveContent,
    commitFrontmatter,
  } as unknown as NoteSession
  return { session, commitFrontmatter }
}

describe('toggleNotePinned', () => {
  it('pins an unopened note via read-patch-write on disk', async () => {
    noteFile.read().mockResolvedValue('# A\n')
    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith(
      'notes/a.md',
      '---\npinned: true\n---\n\n# A\n',
      3,
    )
  })

  it('numbers the pin a gap past the shelf it joins', async () => {
    client.setQueryData(queryKeys.index.pinnedNotes('/g'), [
      { path: 'notes/b.md', title: 'B', dailyDate: null, pinnedOrder: 1024 },
      { path: 'notes/c.md', title: 'C', dailyDate: null, pinnedOrder: 2048 },
    ])
    noteFile.read().mockResolvedValue('# A\n')

    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()

    expect(noteFile.write()).toHaveBeenCalledWith(
      'notes/a.md',
      '---\npinned: 3072\n---\n\n# A\n',
      3,
    )
  })

  it('unpins on disk by removing the key (back to no frontmatter)', async () => {
    noteFile.read().mockResolvedValue('---\npinned: true\n---\n# A\n')
    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith('notes/a.md', '# A\n', 3)
  })

  it('treats an explicit order — including 0 — as pinned, and unpinning clears it', async () => {
    // `pinned: 0` is falsy in JS; a truthiness check would re-pin instead.
    noteFile.read().mockResolvedValue('---\npinned: 0\n---\n# A\n')
    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith('notes/a.md', '# A\n', 3)
  })

  it('routes through the live session, which owns landing the patch', async () => {
    const { session, commitFrontmatter } = fakeSession('# A\n')
    documents.open(session)
    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()
    expect(commitFrontmatter).toHaveBeenCalledWith({ pinned: true })
    expect(noteFile.read()).not.toHaveBeenCalled()
    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('toggles off through the session when the open note is pinned', async () => {
    const { session, commitFrontmatter } = fakeSession('---\npinned: 2\n---\n# A\n')
    documents.open(session)
    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()
    expect(commitFrontmatter).toHaveBeenCalledWith({ pinned: false })
  })

  it('falls back to disk when the session cannot take the patch', async () => {
    const { session } = fakeSession('# A\n', false)
    documents.open(session)
    noteFile.read().mockResolvedValue('# A\n')
    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith(
      'notes/a.md',
      '---\npinned: true\n---\n\n# A\n',
      3,
    )
  })

  it('pins a not-yet-created note by creating its file (the lazy contract)', async () => {
    // ⌘O on a fresh daily whose pane session is still loading: `liveContent`
    // is null (the buffer isn't the truth yet) so the read falls to disk, the
    // session can't take the patch, and the file doesn't exist — a missing
    // note reads as empty, and the pin write is what creates it.
    const { session } = fakeSession('', false, null)
    documents.open(session, 'daily/2026-06-10.md')
    noteFile.read().mockRejectedValue({ kind: 'notFound', message: 'no such note' })
    await expect(toggleNotePinned(app, input('daily/2026-06-10.md'))).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith(
      'daily/2026-06-10.md',
      '---\npinned: true\n---\n\n',
      3,
    )
  })

  it('reports non-notFound read failures through operations', async () => {
    noteFile.read().mockRejectedValue({ kind: 'io', message: 'disk on fire' })
    await expect(toggleNotePinned(app, input())).resolves.toBeUndefined()
    expect(noteFile.write()).not.toHaveBeenCalled()
    expect(operations.snapshot()).toMatchObject([
      { label: 'Updating pin', status: 'failed', message: 'disk on fire' },
    ])
  })
})

describe('unpinNote', () => {
  it('unpins directly without reading the current pin state', async () => {
    noteFile.read().mockResolvedValue('---\npinned: true\n---\n# A\n')

    await unpinNote(app, input())

    expect(noteFile.write()).toHaveBeenCalledWith('notes/a.md', '# A\n', 3)
  })

  it('routes direct unpin through the live session', async () => {
    const { session, commitFrontmatter } = fakeSession('---\npinned: 2\n---\n# A\n')
    documents.open(session)

    await unpinNote(app, input())

    expect(commitFrontmatter).toHaveBeenCalledWith({ pinned: false })
    expect(noteFile.read()).not.toHaveBeenCalled()
  })
})
