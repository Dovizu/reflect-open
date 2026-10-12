import {
  createTestClockService,
  createTestLoggerService,
  createTestNoteFileService,
  createTestOpenDocumentsService,
  createTestOperationsService,
  type TestOperationsService,
} from '@reflect/core/testing'
import {
  createNoteSessionService,
  setDefaultOpenDocuments,
  setDefaultOperations,
  type NoteFileService,
  type NoteSession,
  type OpenDocumentsService,
} from '@reflect/core'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteRow } from '@reflect/core'
import { queryKeys } from '@/lib/query-client.ts'
import { installTestNoteFile } from '@/test-utils/note-file.ts'
import { toggleNotePrivate } from './note-private.ts'

const noteFile = installTestNoteFile()

let client: QueryClient

function input(path = 'notes/a.md') {
  return { queryClient: client, root: '/g', generation: 3, path }
}

let operations: TestOperationsService
let openDocuments: OpenDocumentsService

beforeEach(() => {
  operations = createTestOperationsService()
  setDefaultOperations(operations)
  client = new QueryClient()
  openDocuments = createTestOpenDocumentsService()
  setDefaultOpenDocuments(openDocuments)
})

afterEach(() => {
  setDefaultOpenDocuments(null)
  setDefaultOperations(null)
})

/** An open session of `path`, registered with the open documents. */
function fakeSession(
  content: string,
  canCommit = true,
  liveContent: string | null = content,
  path = 'notes/a.md',
) {
  const commitFrontmatter = vi.fn(async () => canCommit)
  const session = {
    path,
    content: () => content,
    liveContent: () => liveContent,
    commitFrontmatter,
  } as unknown as NoteSession
  openDocuments.register({ session })
  return { session, commitFrontmatter }
}

describe('toggleNotePrivate', () => {
  it('marks an unopened note private via read-patch-write on disk', async () => {
    noteFile.read().mockResolvedValue('# A\n')
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith(
      'notes/a.md',
      '---\nprivate: true\n---\n\n# A\n',
      3,
    )
  })

  it('un-marks on disk by removing the key (back to no frontmatter)', async () => {
    noteFile.read().mockResolvedValue('---\nprivate: true\n---\n# A\n')
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith('notes/a.md', '# A\n', 3)
  })

  it('treats the YAML 1.1-style `private: yes` as private and un-marking clears it', async () => {
    // A 1.2 loader reads `yes` as a string; the schema's coercion still
    // honours it, so the toggle must too — re-marking would be a silent no-op.
    noteFile.read().mockResolvedValue('---\nprivate: yes\n---\n# A\n')
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith('notes/a.md', '# A\n', 3)
  })

  it('replaces an explicit `private: false` with `private: true` when toggling on', async () => {
    noteFile.read().mockResolvedValue('---\nprivate: false\n---\n# A\n')
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith(
      'notes/a.md',
      '---\nprivate: true\n---\n\n# A\n',
      3,
    )
  })

  it('routes through the live session, which owns landing the patch', async () => {
    const { commitFrontmatter } = fakeSession('# A\n')
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(commitFrontmatter).toHaveBeenCalledWith({ private: true })
    expect(noteFile.read()).not.toHaveBeenCalled()
    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('toggles off through the session when the open note is private', async () => {
    const { commitFrontmatter } = fakeSession('---\nprivate: true\n---\n# A\n')
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(commitFrontmatter).toHaveBeenCalledWith({ private: false })
  })

  it('falls back to disk when the session cannot take the patch', async () => {
    fakeSession('# A\n', false)
    noteFile.read().mockResolvedValue('# A\n')
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith(
      'notes/a.md',
      '---\nprivate: true\n---\n\n# A\n',
      3,
    )
  })

  it('marks a not-yet-created note private by creating its file (the lazy contract)', async () => {
    // Still-loading session: `liveContent` is null, so the read falls to disk.
    fakeSession('', false, null, 'daily/2026-06-10.md')
    noteFile.read().mockRejectedValue({ kind: 'notFound', message: 'no such note' })
    await expect(toggleNotePrivate(input('daily/2026-06-10.md'))).resolves.toBeUndefined()
    expect(noteFile.write()).toHaveBeenCalledWith(
      'daily/2026-06-10.md',
      '---\nprivate: true\n---\n\n',
      3,
    )
  })

  it('reports non-notFound read failures through operations', async () => {
    noteFile.read().mockRejectedValue({ kind: 'io', message: 'disk on fire' })
    await expect(toggleNotePrivate(input())).resolves.toBeUndefined()
    expect(noteFile.write()).not.toHaveBeenCalled()
    expect(operations.snapshot()).toMatchObject([
      { label: 'Updating privacy', status: 'failed', message: 'disk on fire' },
    ])
  })
})

function cachedRow(): NoteRow {
  return {
    path: 'notes/a.md',
    title: 'A',
    dailyDate: null,
    isPrivate: false,
    hasConflict: false,
    gistUrl: 'https://gist.example/1',
    gistStale: false,
  }
}

describe('privacy feedback', () => {
  it('updates shared privacy before saving, cancels an old row request, and ignores duplicate input', async () => {
    const queryKey = queryKeys.index.note('/g', 'notes/a.md')
    const previous = cachedRow()
    client.setQueryData(queryKey, previous)
    const stale = Promise.withResolvers<NoteRow>()
    const request = client.fetchQuery({ queryKey, queryFn: () => stale.promise }).catch(() => null)
    const write = Promise.withResolvers<number>()
    noteFile.read().mockResolvedValue('# A\n')
    noteFile.write().mockReturnValueOnce(write.promise)

    const action = toggleNotePrivate(input())
    await vi.waitFor(() => expect(noteFile.write()).toHaveBeenCalledOnce())
    expect(client.getQueryData(queryKey)).toEqual({ ...previous, isPrivate: true })
    await toggleNotePrivate(input())
    expect(noteFile.write()).toHaveBeenCalledOnce()
    stale.resolve(previous)
    await request
    expect(client.getQueryData<NoteRow>(queryKey)?.isPrivate).toBe(true)
    write.resolve(0)
    await action
  })

  it('corrects a stale privacy prediction using the actual file', async () => {
    const queryKey = queryKeys.index.note('/g', 'notes/a.md')
    client.setQueryData(queryKey, cachedRow())
    noteFile.read().mockResolvedValue('---\nprivate: true\n---\n# A\n')
    await toggleNotePrivate(input())
    expect(client.getQueryData<NoteRow>(queryKey)?.isPrivate).toBe(false)
    expect(noteFile.write()).toHaveBeenCalledWith('notes/a.md', '# A\n', 3)
  })

  it('reports a real session write failure, preserves typed text, and allows retry', async () => {
    const queryKey = queryKeys.index.note('/g', 'notes/a.md')
    client.setQueryData(queryKey, cachedRow())
    const write = Promise.withResolvers<void>()
    const writeStarted = Promise.withResolvers<void>()
    const files = createTestNoteFileService({ files: { 'notes/a.md': '# A\n' } })
    const sessionNoteFile: NoteFileService = {
      ...files,
      write: async () => {
        writeStarted.resolve()
        await write.promise
        return 0
      },
    }
    const session = createNoteSessionService({
      noteFile: sessionNoteFile,
      clock: createTestClockService(),
      logger: createTestLoggerService(),
    }).create({
      path: 'notes/a.md',
      generation: () => 3,
      classify: () => 'exact',
      applyContent: () => {},
      onSnapshot: () => {},
    })
    try {
      session.load()
      await vi.waitFor(() => expect(session.liveContent()).toBe('# A\n'))
      const close = openDocuments.register({ session })
      const action = toggleNotePrivate(input())
      await writeStarted.promise
      session.editorChanged('# Typed while locking\n')
      write.reject(new Error('disk full'))
      await action
      expect(operations.snapshot()).toMatchObject([
        { label: 'Updating privacy', status: 'failed', message: 'disk full' },
      ])
      expect(session.content()).toBe('# Typed while locking\n')
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true)
      // The next attempt must reach the writer again, rather than stay guarded.
      session.discard()
      close()
      noteFile.read().mockResolvedValue('# A\n')
      await toggleNotePrivate(input())
      expect(noteFile.write()).toHaveBeenCalledOnce()
    } finally {
      session.discard()
    }
  })
})
