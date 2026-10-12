import { describe, expect, it } from 'vitest'
import {
  createTestNoteSession,
  createTestOpenDocumentsService,
  type TestNoteSessionOptions,
} from '../testing/documents.ts'
import { createTestNoteFileService, type TestNoteFileServiceOptions } from '../testing/graph.ts'
import { createNoteDocumentService } from './note-document-service.ts'

function setup(options?: {
  files?: TestNoteFileServiceOptions['files']
  generation?: number
  session?: Omit<TestNoteSessionOptions, 'path'>
}) {
  const noteFile = createTestNoteFileService({
    ...(options?.files === undefined ? {} : { files: options.files }),
    ...(options?.generation === undefined ? {} : { generation: options.generation }),
  })
  const session =
    options?.session === undefined
      ? null
      : createTestNoteSession({ path: 'notes/a.md', ...options.session })
  const openDocuments = createTestOpenDocumentsService({
    sessions: session === null ? [] : [session],
  })
  const noteDocuments = createNoteDocumentService({ openDocuments, noteFile })
  return { noteDocuments, noteFile, session }
}

describe('readSource', () => {
  it("reads the open session's loaded buffer, not disk", async () => {
    const { noteDocuments } = setup({
      files: { 'notes/a.md': '# disk\n' },
      session: { content: '# live\n' },
    })
    await expect(noteDocuments.readSource('notes/a.md')).resolves.toBe('# live\n')
  })

  it('falls back to disk while the session is still loading (liveContent null)', async () => {
    const { noteDocuments } = setup({
      files: { 'notes/a.md': '# disk\n' },
      session: { content: '', loaded: false },
    })
    await expect(noteDocuments.readSource('notes/a.md')).resolves.toBe('# disk\n')
  })

  it('reads disk when no session is open', async () => {
    const { noteDocuments } = setup({ files: { 'notes/a.md': '# disk\n' } })
    await expect(noteDocuments.readSource('notes/a.md')).resolves.toBe('# disk\n')
  })

  it('reads a missing file as an empty note', async () => {
    const { noteDocuments } = setup()
    await expect(noteDocuments.readSource('notes/a.md')).resolves.toBe('')
  })
})

describe('commitFrontmatter', () => {
  it('lands the patch through the live session when it can take it', async () => {
    const { noteDocuments, noteFile, session } = setup({
      files: { 'notes/a.md': '# A\n' },
      session: { content: '# A\n' },
    })

    await noteDocuments.commitFrontmatter('notes/a.md', { pinned: true }, 3)

    expect(session?.getCalls('commitFrontmatter')).toEqual([[{ pinned: true }]])
    expect(noteFile.writes()).toEqual([])
  })

  it('falls back to a disk patch when the session declines the patch', async () => {
    const { noteDocuments, noteFile } = setup({
      files: { 'notes/a.md': '# A\n' },
      session: { content: '# A\n', accepts: false },
    })

    await noteDocuments.commitFrontmatter('notes/a.md', { pinned: true }, 3)

    expect(noteFile.writes()).toEqual([
      { path: 'notes/a.md', contents: '---\npinned: true\n---\n\n# A\n', generation: 3 },
    ])
  })

  it('patches disk directly when no session is open', async () => {
    const { noteDocuments, noteFile } = setup({ files: { 'notes/a.md': '# A\n' } })

    await noteDocuments.commitFrontmatter('notes/a.md', { private: true }, 3)

    expect(noteFile.writes()).toEqual([
      { path: 'notes/a.md', contents: '---\nprivate: true\n---\n\n# A\n', generation: 3 },
    ])
  })

  it('writes nothing when the patch changes nothing', async () => {
    const { noteDocuments, noteFile } = setup({
      files: { 'notes/a.md': '---\npinned: true\n---\n\n# A\n' },
    })

    await noteDocuments.commitFrontmatter('notes/a.md', { pinned: true }, 3)

    expect(noteFile.writes()).toEqual([])
  })

  it('creates a missing file from the patch', async () => {
    const { noteDocuments, noteFile } = setup()

    await noteDocuments.commitFrontmatter('notes/a.md', { pinned: true }, 3)

    expect(noteFile.files().get('notes/a.md')).toContain('pinned: true')
  })
})

describe('readExisting', () => {
  it('reads the live buffer of an open, ready session', async () => {
    const { noteDocuments } = setup({
      files: { 'notes/a.md': '# On disk' },
      generation: 7,
      session: { content: '# Live' },
    })

    await expect(noteDocuments.readExisting('notes/a.md', 7)).resolves.toBe('# Live')
  })

  it('preserves an authoritative empty live buffer', async () => {
    const { noteDocuments } = setup({
      files: { 'notes/a.md': '# On disk' },
      generation: 7,
      session: { content: '' },
    })

    await expect(noteDocuments.readExisting('notes/a.md', 7)).resolves.toBe('')
  })

  it('refuses a stale live buffer when its generation-pinned file is gone', async () => {
    const { noteDocuments } = setup({ generation: 7, session: { content: '# Stale' } })

    await expect(noteDocuments.readExisting('notes/a.md', 7)).rejects.toMatchObject({
      kind: 'notFound',
    })
  })

  it('refuses a live buffer when the read is pinned to another generation', async () => {
    const { noteDocuments } = setup({
      files: { 'notes/a.md': '# On disk' },
      generation: 7,
      session: { content: '# Live' },
    })

    await expect(noteDocuments.readExisting('notes/a.md', 8)).rejects.toBeDefined()
  })

  it('falls back to a generation-pinned disk read while the session is loading', async () => {
    const { noteDocuments } = setup({
      files: { 'notes/a.md': '# On disk' },
      generation: 7,
      session: { content: '', loaded: false },
    })

    await expect(noteDocuments.readExisting('notes/a.md', 7)).resolves.toBe('# On disk')
    await expect(noteDocuments.readExisting('notes/a.md', 8)).rejects.toBeDefined()
  })
})

describe('isOstensiblyEmpty', () => {
  const { noteDocuments } = setup()

  it('treats blank and frontmatter-only notes as empty', () => {
    expect(noteDocuments.isOstensiblyEmpty('')).toBe(true)
    expect(noteDocuments.isOstensiblyEmpty('\n  \n')).toBe(true)
    expect(noteDocuments.isOstensiblyEmpty('---\npinned: true\n---\n')).toBe(true)
  })

  it('treats plain empty bullets as empty', () => {
    expect(noteDocuments.isOstensiblyEmpty('- ')).toBe(true)
    expect(noteDocuments.isOstensiblyEmpty('  *\n\n+   \n')).toBe(true)
  })

  it('treats bullet content as authored content', () => {
    expect(noteDocuments.isOstensiblyEmpty('- groceries\n')).toBe(false)
  })
})
