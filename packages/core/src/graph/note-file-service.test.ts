import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultFileChanges } from '../indexing/file-change-service.ts'
import {
  createTestClockService,
  createTestFileChangeService,
  createTestIpcBridgeService,
  createTestNoteFileService,
  installTestBridge,
  type TestIpcBridgeService,
} from '../testing/index.ts'
import { readNote, writeNote } from './commands.ts'
import { createNoteFileService, defaultNoteFile, setDefaultNoteFile } from './note-file-service.ts'

afterEach(() => {
  setDefaultNoteFile(null)
  setDefaultFileChanges(null)
})

function setup(ipc: TestIpcBridgeService = createTestIpcBridgeService()) {
  const fileChanges = createTestFileChangeService()
  const clock = createTestClockService({ now: 9_000 })
  return { ipc, fileChanges, noteFile: createNoteFileService({ ipc, clock, fileChanges }) }
}

describe('createNoteFileService', () => {
  it('reads through the optionally pinned commands', async () => {
    const { ipc, noteFile } = setup(
      createTestIpcBridgeService({
        commands: {
          note_read: () => '# A\n',
          note_read_local: () => ({ kind: 'evicted' }),
          note_exists: () => true,
        },
      }),
    )

    await expect(noteFile.read('notes/a.md')).resolves.toBe('# A\n')
    await expect(noteFile.read('notes/a.md', 4)).resolves.toBe('# A\n')
    await expect(noteFile.readLocal('notes/a.md', 4)).resolves.toEqual({ kind: 'evicted' })
    await expect(noteFile.exists('notes/a.md')).resolves.toBe(true)
    expect(ipc.calls()).toEqual([
      { command: 'note_read', args: { path: 'notes/a.md', generation: undefined } },
      { command: 'note_read', args: { path: 'notes/a.md', generation: 4 } },
      { command: 'note_read_local', args: { path: 'notes/a.md', generation: 4 } },
      { command: 'note_exists', args: { path: 'notes/a.md' } },
    ])
  })

  it('reports a write as an own write stamped with the disk mtime', async () => {
    const { ipc, fileChanges, noteFile } = setup()
    ipc.onCommand('note_write', () => 1_234)
    const reported: unknown[] = []
    fileChanges.subscribeOwnWrites((paths) => {
      reported.push(paths)
    })

    await expect(noteFile.write('notes/a.md', 'new', 7)).resolves.toBe(1_234)

    expect(ipc.calls()).toEqual([
      { command: 'note_write', args: { path: 'notes/a.md', contents: 'new', generation: 7 } },
    ])
    expect(fileChanges.ownWrites()).toEqual([['notes/a.md']])
  })

  it('falls back to the clock when the platform reports no mtime', async () => {
    const { ipc, noteFile } = setup()
    ipc.onCommand('note_write', () => null)

    await expect(noteFile.write('notes/a.md', 'new', 7)).resolves.toBe(9_000)
  })

  it('sends `expectedContents` for a checked write and does not report a rejected one', async () => {
    const { ipc, fileChanges, noteFile } = setup()
    ipc.onCommand('note_write', () => {
      throw { kind: 'io', message: 'Note changed on disk; reload before retrying' }
    })

    await expect(noteFile.write('notes/a.md', 'new', 7, null)).rejects.toMatchObject({
      kind: 'io',
    })

    expect(ipc.calls()[0]?.args).toEqual({
      path: 'notes/a.md',
      contents: 'new',
      generation: 7,
      checkContents: true,
      expectedContents: null,
    })
    expect(fileChanges.ownWrites()).toEqual([])
  })

  it('creates a note through the generation-pinned no-clobber command', async () => {
    const { ipc, fileChanges, noteFile } = setup()
    ipc.onCommand('note_create', () => ({ kind: 'created', modifiedMs: 1_234 }))

    await expect(noteFile.create('notes/ideas.md', '# Ideas\n', 7)).resolves.toEqual({
      kind: 'created',
      modifiedMs: 1_234,
    })

    expect(ipc.calls()).toEqual([
      {
        command: 'note_create',
        args: { path: 'notes/ideas.md', contents: '# Ideas\n', generation: 7 },
      },
    ])
    expect(fileChanges.ownWrites()).toEqual([['notes/ideas.md']])
  })

  it('returns a create collision as data without reporting a write', async () => {
    const { ipc, fileChanges, noteFile } = setup()
    ipc.onCommand('note_create', () => ({ kind: 'collision' }))

    await expect(noteFile.create('notes/ideas.md', '# Other\n', 7)).resolves.toEqual({
      kind: 'collision',
    })
    expect(fileChanges.ownWrites()).toEqual([])
  })

  it('propagates a create rejection without reporting a write', async () => {
    const { ipc, fileChanges, noteFile } = setup()
    ipc.onCommand('note_create', () => {
      throw { kind: 'io', message: 'the graph changed since this command was issued; dropping it' }
    })

    await expect(noteFile.create('notes/ideas.md', '# Ideas\n', 6)).rejects.toMatchObject({
      kind: 'io',
    })
    expect(fileChanges.ownWrites()).toEqual([])
  })

  it('reports a delete as an own remove', async () => {
    const { ipc, fileChanges, noteFile } = setup()
    ipc.onCommand('note_delete', () => null)
    const batches: unknown[] = []
    fileChanges.subscribe((batch) => {
      batches.push(batch)
    })

    await noteFile.delete('notes/a.md', 7)

    expect(ipc.calls()).toEqual([
      { command: 'note_delete', args: { path: 'notes/a.md', generation: 7 } },
    ])
    expect(fileChanges.ownWrites()).toEqual([['notes/a.md']])
    expect(batches).toEqual([])
  })

  it('validates the listings', async () => {
    const entry = { path: 'notes/a.md', size: 2, modifiedMs: 5 }
    const { ipc, noteFile } = setup(
      createTestIpcBridgeService({
        commands: {
          list_files: () => [entry],
          list_attachments: () => [],
          dir_list: () => [entry],
          vault_scan_stats: () => ({ notes: 1, attachments: 0, skipped: 2 }),
        },
      }),
    )

    await expect(noteFile.listNotes()).resolves.toEqual([entry])
    await expect(noteFile.listAttachments(3)).resolves.toEqual([])
    await expect(noteFile.listDir('notes', 3)).resolves.toEqual([entry])
    await expect(noteFile.vaultScanStats(3)).resolves.toEqual({
      notes: 1,
      attachments: 0,
      skipped: 2,
    })
    expect(ipc.calls()[2]).toEqual({ command: 'dir_list', args: { dir: 'notes', generation: 3 } })

    ipc.onCommand('list_files', () => [{ path: 'notes/a.md' }])
    await expect(noteFile.listNotes()).rejects.toMatchObject({ kind: 'parse' })
  })
})

describe('defaultNoteFile', () => {
  it('runs over the installed bridge and the current file-change service', async () => {
    const ipc = createTestIpcBridgeService({ commands: { note_write: () => 3 } })
    const uninstall = installTestBridge(ipc)
    const fileChanges = createTestFileChangeService()
    setDefaultFileChanges(fileChanges)
    try {
      await writeNote('notes/a.md', 'a', 1)
      expect(fileChanges.ownWrites()).toEqual([['notes/a.md']])
    } finally {
      uninstall()
    }
  })

  it('is the installed service while one is installed', async () => {
    const noteFile = createTestNoteFileService({ files: { 'notes/a.md': 'a' } })
    setDefaultNoteFile(noteFile)

    expect(defaultNoteFile()).toBe(noteFile)
    await expect(readNote('notes/a.md')).resolves.toBe('a')
  })
})

describe('createTestNoteFileService', () => {
  it('keeps files in memory and records writes', async () => {
    const noteFile = createTestNoteFileService({ files: { 'notes/a.md': 'old' } })

    await noteFile.write('notes/a.md', 'new', 1, 'old')
    await expect(noteFile.write('notes/a.md', 'newer', 1, 'old')).rejects.toMatchObject({
      kind: 'io',
    })
    await expect(noteFile.create('notes/a.md', 'other', 1)).resolves.toEqual({
      kind: 'collision',
    })
    await noteFile.delete('notes/a.md', 1)

    expect(noteFile.getWrites('notes/a.md')).toEqual(['new'])
    expect(noteFile.trashed()).toEqual(['notes/a.md'])
    expect(noteFile.files().size).toBe(0)
  })

  it('reports evicted notes and rejects other generations', async () => {
    const noteFile = createTestNoteFileService({
      files: { 'notes/a.md': 'a' },
      evicted: ['notes/a.md'],
      generation: 2,
    })

    await expect(noteFile.readLocal('notes/a.md', 2)).resolves.toEqual({ kind: 'evicted' })
    await expect(noteFile.listNotes()).resolves.toEqual([
      { path: 'notes/a.md', size: 1, modifiedMs: 0, placeholder: true },
    ])
    await expect(noteFile.read('notes/a.md', 1)).rejects.toMatchObject({ kind: 'io' })
  })
})
