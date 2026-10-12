import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseNote, setDefaultNoteActions } from '@reflect/core'
import {
  createTestClipboardService,
  createTestNoteActionsService,
  createTestNoteFileService,
  createTestOperationsService,
  type TestClipboardService,
  type TestNoteActionsService,
  type TestNoteFileService,
  type TestOperationsService,
} from '@reflect/core/testing'
import { deepLinkForNote, runCopyDeepLink } from './note-deep-link.ts'

const ULID_RE = /^[0-9a-hjkmnp-tv-z]{26}$/

let noteFile: TestNoteFileService
let clipboard: TestClipboardService
let operations: TestOperationsService
let actions: TestNoteActionsService

beforeEach(() => {
  noteFile = createTestNoteFileService()
  clipboard = createTestClipboardService()
  operations = createTestOperationsService()
  actions = createTestNoteActionsService({ noteFile, clipboard, operations })
  setDefaultNoteActions(actions)
})

afterEach(() => {
  setDefaultNoteActions(null)
})

describe('deepLinkForNote', () => {
  it('addresses a daily note by date, touching nothing', async () => {
    await expect(deepLinkForNote('daily/2026-07-01.md', 3)).resolves.toBe(
      'reflect://daily/2026-07-01',
    )
    expect(noteFile.writes()).toEqual([])
  })

  it('uses the existing frontmatter id without writing or reindexing', async () => {
    noteFile.set('notes/a.md', '---\nid: 01hzy3v9k2m4n6p8q0r2s4t6vw\n---\n# A\n')

    await expect(deepLinkForNote('notes/a.md', 3)).resolves.toBe(
      'reflect://note/01hzy3v9k2m4n6p8q0r2s4t6vw',
    )
    expect(noteFile.writes()).toEqual([])
    expect(actions.indexed()).toEqual([])
  })

  it('mints a ULID id on first copy, lands it on disk, and indexes it immediately', async () => {
    noteFile.set('notes/a.md', '# A\n')

    const url = await deepLinkForNote('notes/a.md', 3)

    const id = decodeURIComponent(url.replace('reflect://note/', ''))
    expect(id).toMatch(ULID_RE)
    expect(noteFile.writes()).toMatchObject([{ path: 'notes/a.md', generation: 3 }])
    expect(
      parseNote({ path: 'notes/a.md', source: noteFile.getWrites('notes/a.md')[0] ?? '' })
        .frontmatter.id,
    ).toBe(id)
    // The index trails local writes by a watcher debounce; without this the
    // just-copied link answers "Note not found" until the reindex.
    expect(actions.indexed()).toEqual([{ path: 'notes/a.md', generation: 3 }])
  })
})

describe('runCopyDeepLink', () => {
  it('copies the link and confirms through operations', async () => {
    await runCopyDeepLink('daily/2026-07-01.md', 3)

    expect(clipboard.writes()).toEqual(['reflect://daily/2026-07-01'])
    expect(operations.snapshot()).toMatchObject([{ label: 'Deep link copied' }])
  })
})
