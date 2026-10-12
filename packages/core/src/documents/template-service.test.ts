import { describe, expect, it } from 'vitest'
import { createTestDatabaseService, seedNotes, type TestNote } from '../testing/database.ts'
import {
  createTestNoteMoveService,
  createTestNoteSession,
  createTestOpenDocumentsService,
  createTestTemplateService,
} from '../testing/documents.ts'
import { createTestNoteFileService } from '../testing/graph.ts'
import { createTestIndexStoreService } from '../testing/index-store.ts'
import { createTestOperationsService } from '../testing/operations.ts'
import type { TemplateInsertTarget } from './template-service.ts'

function setup(options?: { files?: Record<string, string>; indexed?: readonly TestNote[] }) {
  const noteFile = createTestNoteFileService({ files: options?.files ?? {} })
  const database = createTestDatabaseService()
  seedNotes(
    database,
    options?.indexed ??
      Object.entries(options?.files ?? {}).map(([path, markdown]) => ({ path, markdown })),
  )
  const operations = createTestOperationsService()
  const openDocuments = createTestOpenDocumentsService()
  const indexStore = createTestIndexStoreService()
  const noteMove = createTestNoteMoveService({
    indexStore: {
      // The native command moves the file along with its rows.
      moveIndexed: async (from, to, fileGeneration) => {
        await indexStore.moveIndexed(from, to, fileGeneration)
        const contents = noteFile.files().get(from)
        if (contents !== undefined) {
          noteFile.set(to, contents)
          await noteFile.delete(from, fileGeneration)
        }
      },
    },
    openDocuments,
  })
  const templates = createTestTemplateService({
    noteFile,
    database,
    openDocuments,
    noteMove,
    operations,
  })
  return { templates, noteFile, database, operations, openDocuments, noteMove }
}

function fakeEditor(): { inserted: string[]; focused: number } & TemplateInsertTarget {
  const editor = {
    inserted: [] as string[],
    focused: 0,
    insertMarkdown(markdown: string) {
      editor.inserted.push(markdown)
    },
    focus() {
      editor.focused += 1
    },
  }
  return editor
}

describe('templateBody', () => {
  it('strips frontmatter — template metadata is never inserted', async () => {
    const { templates } = setup({
      files: { 'templates/journal.md': '---\nprivate: true\n---\n# Journal\n\nMood:\n' },
    })
    await expect(templates.templateBody('templates/journal.md')).resolves.toBe(
      '# Journal\n\nMood:\n',
    )
  })

  it('returns a frontmatter-less template verbatim', async () => {
    const { templates } = setup({
      files: { 'templates/person.md': '# Person\n\n- Company:\n' },
    })
    await expect(templates.templateBody('templates/person.md')).resolves.toBe(
      '# Person\n\n- Company:\n',
    )
  })
})

describe('insertTemplate', () => {
  it('inserts the body at the cursor and refocuses the editor', async () => {
    const { templates, operations } = setup({
      files: { 'templates/journal.md': '# Journal\n\nMood:\n' },
    })
    const editor = fakeEditor()
    await templates.insertTemplate('templates/journal.md', editor)
    expect(editor.inserted).toEqual(['# Journal\n\nMood:\n'])
    expect(editor.focused).toBe(1)
    expect(operations.getAll()).toEqual([])
  })

  it('fails loud when there is no editor to insert into', async () => {
    const { templates, operations } = setup()
    await templates.insertTemplate('templates/journal.md', null)
    expect(operations.snapshot()).toMatchObject([
      { label: 'Inserting template', status: 'failed', message: 'No open note to insert into' },
    ])
  })

  it('surfaces a failed read as a failed operation, never a silent nothing', async () => {
    const { templates, operations } = setup()
    const editor = fakeEditor()
    await templates.insertTemplate('templates/journal.md', editor)
    expect(editor.inserted).toEqual([])
    expect(operations.snapshot()).toMatchObject([{ label: 'Inserting template', status: 'failed' }])
  })
})

describe('slashItems', () => {
  const files = {
    'templates/person.md': '# Person\n\n- Company:\n',
    'templates/journal.md': '# Journal\n\nMood:\n',
    'notes/a.md': '# A\n',
  }

  it('lists every template A→Z under the shared "template" keyword', async () => {
    const { templates } = setup({ files })
    const items = await templates.slashItems(() => null)
    expect(items.map(({ id, label, keywords }) => ({ id, label, keywords }))).toEqual([
      // The shared "template" keyword is the v1 `/template` affordance.
      { id: 'templates/journal.md', label: 'Journal', keywords: ['template'] },
      { id: 'templates/person.md', label: 'Person', keywords: ['template'] },
    ])
  })

  it('inserts the selected template through the shared flow', async () => {
    const { templates } = setup({ files })
    const editor = fakeEditor()
    const items = await templates.slashItems(() => editor)
    items[0]!.onSelect()
    await expect.poll(() => editor.inserted).toEqual(['# Journal\n\nMood:\n'])
  })

  it('resolves the editor at select time, not capture time', async () => {
    const { templates, operations } = setup({ files })
    let editor: TemplateInsertTarget | null = fakeEditor()
    const items = await templates.slashItems(() => editor)
    // The pane unmounted between the menu opening and the select.
    editor = null
    items[0]!.onSelect()
    await expect
      .poll(() => operations.snapshot())
      .toMatchObject([{ label: 'Inserting template', message: 'No open note to insert into' }])
  })
})

describe('createTemplate', () => {
  it('names the template via frontmatter so insertion never injects the name', async () => {
    const { templates, noteFile } = setup()
    await expect(templates.createTemplate('  Daily Review ', 7)).resolves.toBe(
      'templates/daily-review.md',
    )
    expect(noteFile.writes()).toEqual([
      {
        path: 'templates/daily-review.md',
        contents: '---\ntitle: Daily Review\n---\n\n',
        generation: 7,
      },
    ])
  })

  it('picks a collision-free path', async () => {
    const { templates } = setup({ files: { 'templates/daily-review.md': 'Mood:\n' } })
    await expect(templates.createTemplate('Daily Review', 7)).resolves.toBe(
      'templates/daily-review-2.md',
    )
  })
})

describe('renameTemplate', () => {
  it('moves the file and rewrites the H1 the display name derives from', async () => {
    const { templates, noteFile, noteMove } = setup({
      files: { 'templates/journal.md': '# Journal\n\nMood:\n' },
    })

    await expect(
      templates.renameTemplate('templates/journal.md', 'Weekly Journal', 7),
    ).resolves.toBe('templates/weekly-journal.md')
    expect(noteMove.moved()).toEqual([['templates/journal.md', 'templates/weekly-journal.md']])
    // The retitle reads and writes the moved file.
    expect(noteFile.writes()).toEqual([
      {
        path: 'templates/weekly-journal.md',
        contents: '# Weekly Journal\n\nMood:\n',
        generation: 7,
      },
    ])
    expect([...noteFile.files().keys()]).toEqual(['templates/weekly-journal.md'])
  })

  it('a no-op rename neither moves nor writes (its own path counts as free)', async () => {
    const { templates, noteFile, noteMove } = setup({
      files: { 'templates/journal.md': '# Journal\n\nMood:\n' },
    })

    await expect(templates.renameTemplate('templates/journal.md', 'Journal', 7)).resolves.toBe(
      'templates/journal.md',
    )
    expect(noteMove.moved()).toEqual([])
    expect(noteFile.writes()).toEqual([])
  })

  it('flushes the open session before a rename that skips the move', async () => {
    const { templates, openDocuments } = setup({
      files: { 'templates/journal.md': '# Journal\n\nMood:\n' },
    })
    const session = createTestNoteSession({
      path: 'templates/journal.md',
      content: '# Journal\n\nMood:\n',
    })
    openDocuments.register({ session })

    await templates.renameTemplate('templates/journal.md', 'Journal', 7)
    expect(session.getCalls('flush')).toHaveLength(1)
  })

  it('rewrites the H1 preserving frontmatter and the rest of the body', async () => {
    const { templates, noteFile } = setup({
      files: { 'templates/journal.md': '---\nprivate: true\n---\n# Journal\n\n- Mood:\n' },
    })

    await templates.renameTemplate('templates/journal.md', 'Log', 7)
    expect(noteFile.files().get('templates/log.md')).toBe(
      '---\nprivate: true\n---\n# Log\n\n- Mood:\n',
    )
  })

  it('updates a frontmatter title when that is what names the template', async () => {
    const { templates, noteFile } = setup({
      files: { 'templates/journal.md': '---\ntitle: Journal\n---\nMood:\n' },
    })

    await templates.renameTemplate('templates/journal.md', 'Log', 7)
    const written = noteFile.files().get('templates/log.md')
    expect(written).toContain('title: Log')
    expect(written).toContain('Mood:\n')
  })

  it('leaves an untitled (filename-named) template body untouched', async () => {
    const { templates, noteFile, noteMove } = setup({
      files: { 'templates/journal.md': 'Mood:\n' },
    })

    await templates.renameTemplate('templates/journal.md', 'Log', 7)
    expect(noteMove.moved()).toEqual([['templates/journal.md', 'templates/log.md']])
    expect(noteFile.writes()).toEqual([])
  })
})
