import { describe, expect, it, vi } from 'vitest'
import { MIN_VISIBLE_MS } from '../app/operations-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import { createTestClockService } from '../testing/clock.ts'
import {
  createTestNoteActionsService,
  createTestNoteSession,
  createTestOpenDocumentsService,
  type TestNoteSessionOptions,
} from '../testing/documents.ts'
import { parseNote } from '../markdown/extract.ts'
import { createTestNoteFileService } from '../testing/graph.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestOperationsService } from '../testing/operations.ts'
import { createTestClipboardService } from '../testing/shell.ts'
import { canTrashNote } from './note-actions-service.ts'
import { createNoteSessionService } from './note-session.ts'
import type { NoteSession, NoteSessionSnapshot } from './note-session-types.ts'

const ULID_RE = /^[0-9a-hjkmnp-tv-z]{26}$/

function setup(options?: {
  files?: Readonly<Record<string, string>>
  session?: TestNoteSessionOptions
  /** Wraps the in-memory files, e.g. to make a call fail. */
  wrapNoteFile?: (files: NoteFileService) => NoteFileService
  indexNote?: () => Promise<void>
}) {
  const files = createTestNoteFileService(
    options?.files === undefined ? {} : { files: options.files },
  )
  const session = options?.session === undefined ? null : createTestNoteSession(options.session)
  const openDocuments = createTestOpenDocumentsService({
    sessions: session === null ? [] : [session],
  })
  const operations = createTestOperationsService()
  const clipboard = createTestClipboardService()
  const actions = createTestNoteActionsService({
    noteFile: options?.wrapNoteFile?.(files) ?? files,
    openDocuments,
    operations,
    clipboard,
    ...(options?.indexNote === undefined
      ? {}
      : { indexLifecycle: { indexNote: options.indexNote } }),
  })
  return { actions, files, session, openDocuments, operations, clipboard }
}

function failing(method: 'read' | 'write' | 'delete', error: unknown) {
  return (files: NoteFileService): NoteFileService => ({
    ...files,
    [method]: async () => {
      throw error
    },
  })
}

describe('togglePinned', () => {
  it('pins an unpinned note with the prepared order', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '# A\n' } })

    await expect(actions.togglePinned('notes/a.md', 3, { prepare: () => 3072 })).resolves.toEqual({
      status: 'done',
      pinned: true,
      pinOrder: 3072,
    })

    expect(files.writes()).toEqual([
      { path: 'notes/a.md', contents: '---\npinned: 3072\n---\n\n# A\n', generation: 3 },
    ])
  })

  it('writes a bare `pinned: true` when the prepared order is null', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '# A\n' } })

    await expect(actions.togglePinned('notes/a.md', 3, { prepare: () => null })).resolves.toEqual({
      status: 'done',
      pinned: true,
      pinOrder: null,
    })

    expect(files.getWrites('notes/a.md')).toEqual(['---\npinned: true\n---\n\n# A\n'])
  })

  it('unpins a pinned note by removing the key, whatever order was prepared', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '---\npinned: true\n---\n# A\n' } })

    await expect(actions.togglePinned('notes/a.md', 3, { prepare: () => 1024 })).resolves.toEqual({
      status: 'done',
      pinned: false,
      pinOrder: null,
    })

    expect(files.getWrites('notes/a.md')).toEqual(['# A\n'])
  })

  it('treats an explicit order, including 0, as pinned', async () => {
    // `pinned: 0` is falsy in JS; a truthiness check would re-pin instead.
    const { actions, files } = setup({ files: { 'notes/a.md': '---\npinned: 0\n---\n# A\n' } })

    const outcome = await actions.togglePinned('notes/a.md', 3, { prepare: () => null })

    expect(outcome).toMatchObject({ status: 'done', pinned: false })
    expect(files.getWrites('notes/a.md')).toEqual(['# A\n'])
  })

  it('routes through the live session, which owns landing the patch', async () => {
    const { actions, files, session } = setup({
      session: { path: 'notes/a.md', content: '---\npinned: 2\n---\n# A\n' },
    })

    await actions.togglePinned('notes/a.md', 3, { prepare: () => null })

    expect(session?.getCalls('commitFrontmatter')).toEqual([[{ pinned: false }]])
    expect(files.writes()).toEqual([])
  })

  it('pins a not-yet-created note by creating its file (the lazy contract)', async () => {
    // A pane session that is still loading: `liveContent` is null, the session
    // cannot take the patch, and the file does not exist. A missing note reads
    // as empty, and the pin write is what creates it.
    const { actions, files } = setup({
      session: { path: 'daily/2026-06-10.md', loaded: false, accepts: false },
    })

    await actions.togglePinned('daily/2026-06-10.md', 3, { prepare: () => null })

    expect(files.getWrites('daily/2026-06-10.md')).toEqual(['---\npinned: true\n---\n\n'])
  })

  it('answers `busy` to a second call while the first is in flight, without preparing it', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '# A\n' } })
    const gate = Promise.withResolvers<number | null>()
    const first = actions.togglePinned('notes/a.md', 3, { prepare: () => gate.promise })
    const prepare = vi.fn(() => null)

    await expect(actions.togglePinned('notes/a.md', 3, { prepare })).resolves.toEqual({
      status: 'busy',
    })
    const prepareUnpin = vi.fn<() => void>()
    await expect(actions.unpin('notes/a.md', 3, { prepare: prepareUnpin })).resolves.toEqual({
      status: 'busy',
    })
    expect(prepare).not.toHaveBeenCalled()
    expect(prepareUnpin).not.toHaveBeenCalled()

    gate.resolve(1024)
    await expect(first).resolves.toMatchObject({ status: 'done', pinOrder: 1024 })
    expect(files.writes()).toHaveLength(1)
  })

  it('does not dedupe across notes or generations', async () => {
    const { actions } = setup({ files: { 'notes/a.md': '# A\n', 'notes/b.md': '# B\n' } })
    const gate = Promise.withResolvers<number | null>()
    const first = actions.togglePinned('notes/a.md', 3, { prepare: () => gate.promise })

    await expect(
      actions.togglePinned('notes/b.md', 3, { prepare: () => null }),
    ).resolves.toMatchObject({ status: 'done' })
    await expect(
      actions.togglePinned('notes/a.md', 4, { prepare: () => null }),
    ).resolves.toMatchObject({ status: 'done' })

    gate.resolve(null)
    await first
  })

  it('reports a failure through operations and accepts a retry', async () => {
    let fail = true
    const { actions, files, operations } = setup({
      files: { 'notes/a.md': '# A\n' },
      wrapNoteFile: (inner) => ({
        ...inner,
        read: async (...args) => {
          if (fail) {
            throw { kind: 'io', message: 'disk on fire' }
          }
          return await inner.read(...args)
        },
      }),
    })

    await expect(actions.togglePinned('notes/a.md', 3, { prepare: () => null })).resolves.toEqual({
      status: 'failed',
    })
    expect(files.writes()).toEqual([])
    expect(operations.snapshot()).toMatchObject([
      { label: 'Updating pin', status: 'failed', message: 'disk on fire' },
    ])

    fail = false
    await expect(
      actions.togglePinned('notes/a.md', 3, { prepare: () => null }),
    ).resolves.toMatchObject({ status: 'done' })
  })

  it('fails the action when `prepare` throws', async () => {
    const { actions, files, operations } = setup({ files: { 'notes/a.md': '# A\n' } })

    const outcome = await actions.togglePinned('notes/a.md', 3, {
      prepare: () => {
        throw new Error('cache gone')
      },
    })

    expect(outcome).toEqual({ status: 'failed' })
    expect(files.writes()).toEqual([])
    expect(operations.snapshot()).toMatchObject([{ label: 'Updating pin', message: 'cache gone' }])
  })
})

describe('unpin', () => {
  it('unpins directly without reading the current pin state', async () => {
    const { actions, session } = setup({
      session: { path: 'notes/a.md', content: '---\npinned: 2\n---\n# A\n' },
    })
    const liveContent = vi.spyOn(session!, 'liveContent')
    const prepare = vi.fn()

    await expect(actions.unpin('notes/a.md', 3, { prepare })).resolves.toEqual({
      status: 'done',
      pinned: false,
      pinOrder: null,
    })

    expect(prepare).toHaveBeenCalledOnce()
    expect(liveContent).not.toHaveBeenCalled()
    expect(session?.getCalls('commitFrontmatter')).toEqual([[{ pinned: false }]])
  })

  it('unpins on disk by removing the key', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '---\npinned: true\n---\n# A\n' } })

    await actions.unpin('notes/a.md', 3)

    expect(files.getWrites('notes/a.md')).toEqual(['# A\n'])
  })
})

describe('reorderPinned', () => {
  it('writes each valid order and returns what it wrote', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '# A\n', 'notes/c.md': '# C\n' } })

    await expect(
      actions.reorderPinned(
        [
          { path: 'notes/c.md', pinnedOrder: 1024 },
          { path: 'notes/a.md', pinnedOrder: 1536 },
          { path: 'notes/b.md', pinnedOrder: null },
          { path: 'notes/d.md', pinnedOrder: -1 },
        ],
        3,
      ),
    ).resolves.toEqual([
      { path: 'notes/c.md', pinOrder: 1024 },
      { path: 'notes/a.md', pinOrder: 1536 },
    ])

    expect(files.getWrites('notes/c.md')).toEqual(['---\npinned: 1024\n---\n\n# C\n'])
    expect(files.getWrites('notes/a.md')).toEqual(['---\npinned: 1536\n---\n\n# A\n'])
    expect(files.getWrites('notes/b.md')).toEqual([])
    expect(files.getWrites('notes/d.md')).toEqual([])
  })

  it('routes open notes through their sessions', async () => {
    const { actions, files, session } = setup({ session: { path: 'notes/a.md', content: '# A\n' } })

    await actions.reorderPinned([{ path: 'notes/a.md', pinnedOrder: 1024 }], 3)

    expect(session?.getCalls('commitFrontmatter')).toEqual([[{ pinned: 1024 }]])
    expect(files.writes()).toEqual([])
  })

  it('rejects when a write fails', async () => {
    const { actions } = setup({
      files: { 'notes/a.md': '# A\n' },
      wrapNoteFile: failing('write', new Error('disk full')),
    })

    await expect(
      actions.reorderPinned([{ path: 'notes/a.md', pinnedOrder: 1024 }], 3),
    ).rejects.toThrow('disk full')
  })
})

describe('togglePrivate', () => {
  it('marks a note private and returns the new state', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '# A\n' } })

    await expect(actions.togglePrivate('notes/a.md', 3)).resolves.toEqual({
      status: 'done',
      isPrivate: true,
    })

    expect(files.writes()).toEqual([
      { path: 'notes/a.md', contents: '---\nprivate: true\n---\n\n# A\n', generation: 3 },
    ])
  })

  it('un-marks by removing the key, honouring the YAML 1.1-style `private: yes`', async () => {
    // A 1.2 loader reads `yes` as a string; the schema's coercion still
    // honours it, so the toggle must too: re-marking would be a silent no-op.
    const { actions, files } = setup({ files: { 'notes/a.md': '---\nprivate: yes\n---\n# A\n' } })

    await expect(actions.togglePrivate('notes/a.md', 3)).resolves.toEqual({
      status: 'done',
      isPrivate: false,
    })

    expect(files.getWrites('notes/a.md')).toEqual(['# A\n'])
  })

  it('routes through the live session', async () => {
    const { actions, files, session } = setup({ session: { path: 'notes/a.md', content: '# A\n' } })

    await actions.togglePrivate('notes/a.md', 3)

    expect(session?.getCalls('commitFrontmatter')).toEqual([[{ private: true }]])
    expect(files.writes()).toEqual([])
  })

  it('prepares before touching the note and answers `busy` to a duplicate', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '# A\n' } })
    const gate = Promise.withResolvers<void>()
    const first = actions.togglePrivate('notes/a.md', 3, { prepare: () => gate.promise })
    const prepare = vi.fn()

    await expect(actions.togglePrivate('notes/a.md', 3, { prepare })).resolves.toEqual({
      status: 'busy',
    })
    expect(prepare).not.toHaveBeenCalled()
    expect(files.writes()).toEqual([])

    gate.resolve()
    await expect(first).resolves.toEqual({ status: 'done', isPrivate: true })
  })

  it('is deduped apart from pin actions on the same note', async () => {
    const { actions } = setup({ files: { 'notes/a.md': '# A\n' } })
    const gate = Promise.withResolvers<number | null>()
    const pin = actions.togglePinned('notes/a.md', 3, { prepare: () => gate.promise })

    await expect(actions.togglePrivate('notes/a.md', 3)).resolves.toMatchObject({ status: 'done' })

    gate.resolve(null)
    await pin
  })

  it('reports a failure through operations and accepts a retry', async () => {
    const { actions, operations } = setup({
      files: { 'notes/a.md': '# A\n' },
      wrapNoteFile: failing('write', new Error('disk full')),
    })

    await expect(actions.togglePrivate('notes/a.md', 3)).resolves.toEqual({ status: 'failed' })
    expect(operations.snapshot()).toMatchObject([
      { label: 'Updating privacy', status: 'failed', message: 'disk full' },
    ])
    await expect(actions.togglePrivate('notes/a.md', 3)).resolves.toEqual({ status: 'failed' })
  })
})

/** A session of a note with no file yet; `beforeWrite` runs before each write lands. */
function lazySession(
  files: NoteFileService,
  beforeWrite: () => Promise<void>,
): { readonly session: NoteSession; readonly snapshots: NoteSessionSnapshot[] } {
  const snapshots: NoteSessionSnapshot[] = []
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
  return { session, snapshots }
}

describe('trash', () => {
  it('trashes a note with no open session', async () => {
    const { actions, files } = setup({ files: { 'notes/keep.md': '# Keep\n' } })

    await expect(actions.trash('notes/keep.md', 7)).resolves.toEqual({
      succeeded: ['notes/keep.md'],
      failed: [],
    })

    expect(files.trashed()).toEqual(['notes/keep.md'])
  })

  it('trashes the file, then discards its open session so it cannot resurrect', async () => {
    const { actions, files, session } = setup({
      files: { 'notes/gone.md': '# Gone\n' },
      session: { path: 'notes/gone.md', content: '# Gone\n' },
    })
    const deleteFile = vi.spyOn(files, 'delete')

    await actions.trash('notes/gone.md', 3)

    expect(deleteFile).toHaveBeenCalledWith('notes/gone.md', 3)
    // Discarded *after* the file is gone: otherwise a teardown flush could
    // re-create it.
    expect(session?.calls().map((call) => call.method)).toEqual(['prepareDelete', 'discard'])
  })

  it('discards a new note that has not reached disk without trashing a file', async () => {
    const { actions, files, session } = setup({
      session: { path: 'notes/new.md', unpersisted: true },
    })
    const deleteFile = vi.spyOn(files, 'delete')

    await expect(actions.trash('notes/new.md', 7)).resolves.toEqual({
      succeeded: ['notes/new.md'],
      failed: [],
    })

    expect(deleteFile).not.toHaveBeenCalled()
    expect(session?.getCalls('discard')).toHaveLength(1)
  })

  it('waits for a new note to load, then discards it without deleting a missing file', async () => {
    const files = createTestNoteFileService()
    const { session } = lazySession(files, async () => {})
    const { actions } = setupWith(files, session)
    const deleteFile = vi.spyOn(files, 'delete')
    const discard = vi.spyOn(session, 'discard')
    session.load()

    await actions.trash('notes/new.md', 3)

    expect(deleteFile).not.toHaveBeenCalled()
    expect(discard).toHaveBeenCalledOnce()
  })

  it("waits for a new note's in-flight first write before deleting its file", async () => {
    const files = createTestNoteFileService()
    const writeStarted = Promise.withResolvers<void>()
    const allowWrite = Promise.withResolvers<void>()
    const { session, snapshots } = lazySession(files, async () => {
      writeStarted.resolve()
      await allowWrite.promise
    })
    const { actions } = setupWith(files, session)
    const deleteFile = vi.spyOn(files, 'delete')
    session.load()
    await vi.waitFor(() => expect(snapshots.at(-1)?.status).toBe('ready'))
    session.editorChanged('# Draft\n')
    const flush = session.flush()
    await writeStarted.promise

    const deletion = actions.trash('notes/new.md', 3)
    await Promise.resolve()
    expect(deleteFile).not.toHaveBeenCalled()

    allowWrite.resolve()
    await Promise.all([flush, deletion])

    expect(deleteFile).toHaveBeenCalledWith('notes/new.md', 3)
    expect(files.trashed()).toEqual(['notes/new.md'])
    expect(files.files().has('notes/new.md')).toBe(false)
  })

  it('leaves the session intact and resumes persistence when the delete fails', async () => {
    const { actions, session, openDocuments } = setup({
      session: { path: 'notes/gone.md', content: '# Gone\n' },
      wrapNoteFile: failing('delete', new Error('disk full')),
    })
    const sessionFor = vi.spyOn(openDocuments, 'sessionFor')

    const result = await actions.trash('notes/gone.md', 3)

    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([{ path: 'notes/gone.md', cause: new Error('disk full') }])
    // The session was never discarded: the screen stays editable.
    expect(session?.getCalls('discard')).toEqual([])
    expect(session?.getCalls('cancelDelete')).toHaveLength(1)
    expect(sessionFor).toHaveBeenCalledOnce()
  })

  it('refuses a daily note and never touches disk or sessions', async () => {
    const { actions, files, openDocuments } = setup({ files: { 'daily/2026-06-15.md': '# Day\n' } })
    const sessionFor = vi.spyOn(openDocuments, 'sessionFor')

    const result = await actions.trash('daily/2026-06-15.md', 7)

    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([
      { path: 'daily/2026-06-15.md', cause: new Error('Daily notes cannot be deleted') },
    ])
    expect(files.trashed()).toEqual([])
    expect(sessionFor).not.toHaveBeenCalled()
  })

  it('shares the daily rule with `canTrash`', () => {
    const { actions } = setup()
    expect(actions.canTrash('daily/2026-06-15.md')).toBe(false)
    expect(actions.canTrash('notes/a.md')).toBe(true)
    expect(canTrashNote('daily/2026-06-15.md')).toBe(false)
  })
})

function setupWith(files: NoteFileService, session: NoteSession) {
  const openDocuments = createTestOpenDocumentsService({ sessions: [session] })
  const actions = createTestNoteActionsService({ noteFile: files, openDocuments })
  return { actions }
}

describe('trashMany', () => {
  it('is a no-op for no paths', async () => {
    const { actions, operations } = setup()

    await expect(actions.trashMany([], 1)).resolves.toEqual({ succeeded: [], failed: [] })

    expect(operations.getAll()).toEqual([])
  })

  it('trashes every note in order under one operation', async () => {
    const { actions, files, operations } = setup({
      files: { 'notes/a.md': '# A\n', 'notes/b.md': '# B\n' },
    })
    const onTrashed = vi.fn()

    await expect(
      actions.trashMany(['notes/a.md', 'notes/b.md'], 1, { onTrashed }),
    ).resolves.toEqual({ succeeded: ['notes/a.md', 'notes/b.md'], failed: [] })

    expect(files.trashed()).toEqual(['notes/a.md', 'notes/b.md'])
    expect(onTrashed.mock.calls).toEqual([['notes/a.md'], ['notes/b.md']])
    expect(operations.snapshot()).toMatchObject([{ label: 'Trashing notes', status: 'running' }])
    await operations.clock.advance(MIN_VISIBLE_MS)
    expect(operations.getAll()).toEqual([])
  })

  it('keeps going past a failure and fails the operation with the last error', async () => {
    const { actions, files, operations } = setup({
      files: { 'notes/a.md': '# A\n', 'notes/b.md': '# B\n', 'notes/c.md': '# C\n' },
      wrapNoteFile: (inner) => ({
        ...inner,
        delete: async (path, generation) => {
          if (path === 'notes/b.md') {
            throw new Error('locked')
          }
          await inner.delete(path, generation)
        },
      }),
    })
    const onTrashed = vi.fn()

    const result = await actions.trashMany(
      ['notes/a.md', 'notes/b.md', 'daily/2026-06-15.md', 'notes/c.md'],
      1,
      { onTrashed },
    )

    expect(result.succeeded).toEqual(['notes/a.md', 'notes/c.md'])
    expect(result.failed.map((failure) => failure.path)).toEqual([
      'notes/b.md',
      'daily/2026-06-15.md',
    ])
    expect(files.trashed()).toEqual(['notes/a.md', 'notes/c.md'])
    expect(onTrashed.mock.calls).toEqual([['notes/a.md'], ['notes/c.md']])
    expect(operations.snapshot()).toMatchObject([
      { label: 'Trashing notes', status: 'failed', message: 'Daily notes cannot be deleted' },
    ])
  })
})

describe('deepLinkFor', () => {
  it('addresses a daily note by date, touching nothing', async () => {
    const { actions, files } = setup()
    const read = vi.spyOn(files, 'read')

    await expect(actions.deepLinkFor('daily/2026-07-01.md', 3)).resolves.toBe(
      'reflect://daily/2026-07-01',
    )

    expect(read).not.toHaveBeenCalled()
    expect(files.writes()).toEqual([])
  })

  it('addresses an impossible-date daily file like a plain note (mints an id)', async () => {
    // The router opens daily/2026-02-31.md as a plain note; a date-form link
    // would be one the parser rejects.
    const { actions, files } = setup({ files: { 'daily/2026-02-31.md': '# Not a real day\n' } })

    const url = await actions.deepLinkFor('daily/2026-02-31.md', 3)

    expect(url.startsWith('reflect://note/')).toBe(true)
    expect(files.writes()).toHaveLength(1)
  })

  it('uses the existing frontmatter id without writing or reindexing', async () => {
    const { actions, files } = setup({
      files: { 'notes/a.md': '---\nid: 01hzy3v9k2m4n6p8q0r2s4t6vw\n---\n# A\n' },
    })

    await expect(actions.deepLinkFor('notes/a.md', 3)).resolves.toBe(
      'reflect://note/01hzy3v9k2m4n6p8q0r2s4t6vw',
    )

    expect(files.writes()).toEqual([])
    expect(actions.indexed()).toEqual([])
  })

  it('treats a blank frontmatter id as absent and mints a real one', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '---\nid: ""\n---\n# A\n' } })

    const url = await actions.deepLinkFor('notes/a.md', 3)

    expect(url.replace('reflect://note/', '')).toMatch(ULID_RE)
    expect(files.writes()).toHaveLength(1)
  })

  it('mints a ULID id on first use, lands it on disk, and indexes it immediately', async () => {
    const { actions, files } = setup({ files: { 'notes/a.md': '# A\n' } })

    const url = await actions.deepLinkFor('notes/a.md', 3)

    const id = url.replace('reflect://note/', '')
    expect(id).toMatch(ULID_RE)
    expect(files.writes()).toMatchObject([{ path: 'notes/a.md', generation: 3 }])
    const source = files.files().get('notes/a.md') ?? ''
    expect(parseNote({ path: 'notes/a.md', source }).frontmatter.id).toBe(id)
    expect(source.endsWith('---\n\n# A\n')).toBe(true)
    // The index trails local writes by a watcher debounce; without this the
    // just-copied link answers "Note not found" until the reindex.
    expect(actions.indexed()).toEqual([{ path: 'notes/a.md', generation: 3 }])
  })

  it('still returns the link when the immediate reindex fails', async () => {
    const { actions } = setup({
      files: { 'notes/a.md': '# A\n' },
      indexNote: async () => {
        throw new Error('index busy')
      },
    })

    const url = await actions.deepLinkFor('notes/a.md', 3)

    expect(url.startsWith('reflect://note/')).toBe(true)
  })

  it('mints through the live session when one owns the note', async () => {
    const { actions, files, session } = setup({ session: { path: 'notes/a.md', content: '# A\n' } })

    const url = await actions.deepLinkFor('notes/a.md', 3)

    const id = url.replace('reflect://note/', '')
    expect(session?.getCalls('commitFrontmatter')).toEqual([[{ id }]])
    expect(files.writes()).toEqual([])
  })
})

describe('copyDeepLink', () => {
  it('copies the link and confirms through operations', async () => {
    const { actions, clipboard, operations } = setup()

    await actions.copyDeepLink('daily/2026-07-01.md', 3)

    expect(clipboard.writes()).toEqual(['reflect://daily/2026-07-01'])
    expect(operations.snapshot()).toMatchObject([{ label: 'Deep link copied', status: 'running' }])
  })

  it('reports a failure to build the link', async () => {
    const { actions, clipboard, operations } = setup({
      files: { 'notes/a.md': '# A\n' },
      wrapNoteFile: failing('write', new Error('disk full')),
    })

    await actions.copyDeepLink('notes/a.md', 3)

    expect(clipboard.writes()).toEqual([])
    expect(operations.snapshot()).toMatchObject([
      { label: 'Copying deep link', status: 'failed', message: 'disk full' },
    ])
  })

  it('reports a clipboard failure', async () => {
    const { actions, clipboard, operations } = setup()
    clipboard.failWith(new Error('denied'))

    await actions.copyDeepLink('daily/2026-07-01.md', 3)

    expect(operations.snapshot()).toMatchObject([
      { label: 'Copying deep link', status: 'failed', message: 'denied' },
    ])
  })
})

describe('copyPath', () => {
  it('copies the OS-joined absolute path and completes the operation', async () => {
    const { actions, clipboard, operations } = setup()

    await actions.copyPath('/g', 'notes/a.md')

    expect(clipboard.writes()).toEqual(['/g/notes/a.md'])
    expect(operations.snapshot()).toMatchObject([{ label: 'Note path copied', status: 'running' }])
    await operations.clock.advance(MIN_VISIBLE_MS)
    expect(operations.getAll()).toEqual([])
  })

  it('fails loudly when no graph is open', async () => {
    const { actions, operations } = setup()

    await actions.copyPath(null, 'notes/a.md')

    expect(operations.snapshot()).toMatchObject([
      { label: 'Copying note path', status: 'failed', message: 'No graph is open' },
    ])
  })

  it('reports a clipboard failure through the operation', async () => {
    const { actions, clipboard, operations } = setup()
    clipboard.failWith(new Error('denied'))

    await actions.copyPath('/g', 'notes/a.md')

    expect(operations.snapshot()).toMatchObject([
      { label: 'Copying note path', status: 'failed', message: 'denied' },
    ])
  })
})
