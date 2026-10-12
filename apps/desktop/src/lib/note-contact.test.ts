import { describe, expect, it, vi } from 'vitest'
import type { ContactMatch } from '@reflect/core'
import type { NoteSession } from '@/editor/note-session.ts'
import { installTestOpenDocuments } from '@/test-utils/open-documents.ts'
import { installTestNoteFile } from '@/test-utils/note-file.ts'
import { addContactToNote, ignoreContactSuggestion } from './note-contact.ts'

const documents = installTestOpenDocuments()
const noteFile = installTestNoteFile()

const ADA: ContactMatch = {
  fullName: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  emails: ['ada@example.com'],
  phones: ['+1 555 0100'],
}

const ADA_BLOCK = '- Type: #person\n- Email: ada@example.com\n- Phone: +1 555 0100'

function fakeSession(content: string, { canAppend = true, canCommit = true } = {}) {
  const commitBodyAppend = vi.fn(async () => canAppend)
  const commitFrontmatter = vi.fn(async () => canCommit)
  const session = {
    content: () => content,
    liveContent: () => content,
    commitBodyAppend,
    commitFrontmatter,
  } as unknown as NoteSession
  return { session, commitBodyAppend, commitFrontmatter }
}

describe('addContactToNote', () => {
  it('appends the details block through the live session — a single write', async () => {
    const { session, commitBodyAppend, commitFrontmatter } = fakeSession('# Ada Lovelace\n')
    documents.open(session, 'notes/Ada Lovelace.md')

    await addContactToNote('notes/Ada Lovelace.md', ADA, 3)

    expect(commitBodyAppend).toHaveBeenCalledWith(ADA_BLOCK)
    // No frontmatter mark: the appended details suppress the card by content.
    expect(commitFrontmatter).not.toHaveBeenCalled()
    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('refuses rather than clobber when the open session cannot take the append', async () => {
    const { session } = fakeSession('# Ada Lovelace\n', { canAppend: false })
    documents.open(session, 'notes/Ada Lovelace.md')

    await expect(addContactToNote('notes/Ada Lovelace.md', ADA, 3)).rejects.toThrow(
      /can’t be updated right now/,
    )
    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('patches a closed note on disk in one write', async () => {
    noteFile.read().mockResolvedValue('# Ada Lovelace\n')

    await addContactToNote('notes/Ada Lovelace.md', ADA, 3)

    expect(noteFile.service().writes()).toEqual([
      {
        path: 'notes/Ada Lovelace.md',
        contents: `# Ada Lovelace\n\n${ADA_BLOCK}\n`,
        generation: 3,
      },
    ])
  })

  it('refuses when the title no longer matches the contact (stale card)', async () => {
    const { session, commitBodyAppend } = fakeSession('# Grace Hopper\n')
    documents.open(session, 'notes/Ada Lovelace.md')

    await expect(addContactToNote('notes/Ada Lovelace.md', ADA, 3)).rejects.toThrow(
      /no longer matches/,
    )
    expect(commitBodyAppend).not.toHaveBeenCalled()
    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('appends only the details to an already-typed person note (meeting flow, link menu)', async () => {
    const { session, commitBodyAppend } = fakeSession('# Ada Lovelace\n\n- Type: #person\n')
    documents.open(session, 'notes/Ada Lovelace.md')

    await addContactToNote('notes/Ada Lovelace.md', ADA, 3)

    expect(commitBodyAppend).toHaveBeenCalledWith('- Email: ada@example.com\n- Phone: +1 555 0100')
  })

  it('is retry-idempotent: a body already carrying the block writes nothing', async () => {
    noteFile.read().mockResolvedValue(`# Ada Lovelace\n\n${ADA_BLOCK}\n`)

    await addContactToNote('notes/Ada Lovelace.md', ADA, 3)

    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('skips when the body already has hand-typed details (stale card)', async () => {
    // The card would have been suppressed had its query refetched; Add must
    // apply the same content gate rather than stack a second block.
    const { session, commitBodyAppend } = fakeSession('# Ada Lovelace\n\nWork mail ada@work.com\n')
    documents.open(session, 'notes/Ada Lovelace.md')

    await addContactToNote('notes/Ada Lovelace.md', ADA, 3)

    expect(commitBodyAppend).not.toHaveBeenCalled()
    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('writes nothing for a contact with no details', async () => {
    const bare: ContactMatch = { ...ADA, emails: [], phones: [] }
    noteFile.read().mockResolvedValue('# Ada Lovelace\n')

    await addContactToNote('notes/Ada Lovelace.md', bare, 3)

    expect(noteFile.write()).not.toHaveBeenCalled()
  })
})

describe('ignoreContactSuggestion', () => {
  it('records the contact name in ignoredContacts through the live session', async () => {
    const { session, commitBodyAppend, commitFrontmatter } = fakeSession('# Ada Lovelace\n')
    documents.open(session, 'notes/Ada Lovelace.md')

    await ignoreContactSuggestion('notes/Ada Lovelace.md', ADA, 3)

    expect(commitFrontmatter).toHaveBeenCalledWith({ ignoredContacts: ['Ada Lovelace'] })
    expect(commitBodyAppend).not.toHaveBeenCalled()
  })

  it('appends to an existing dismissal list on disk', async () => {
    noteFile
      .read()
      .mockResolvedValue('---\nignoredContacts:\n  - Grace Hopper\n---\n# Ada Lovelace\n')

    await ignoreContactSuggestion('notes/Ada Lovelace.md', ADA, 3)

    expect(noteFile.write()).toHaveBeenCalledWith(
      'notes/Ada Lovelace.md',
      '---\nignoredContacts:\n  - Grace Hopper\n  - Ada Lovelace\n---\n\n# Ada Lovelace\n',
      3,
    )
  })

  it('is idempotent: an already-dismissed contact writes nothing', async () => {
    noteFile
      .read()
      .mockResolvedValue('---\nignoredContacts:\n  - ada lovelace\n---\n# Ada Lovelace\n')

    await ignoreContactSuggestion('notes/Ada Lovelace.md', ADA, 3)

    expect(noteFile.write()).not.toHaveBeenCalled()
  })

  it('skips the write when the title no longer matches (stale card)', async () => {
    // The user wanted the stale card gone; the new title must stay eligible
    // for its own suggestion, so nothing is written.
    const { session, commitFrontmatter } = fakeSession('# Grace Hopper\n')
    documents.open(session, 'notes/Ada Lovelace.md')

    await ignoreContactSuggestion('notes/Ada Lovelace.md', ADA, 3)

    expect(commitFrontmatter).not.toHaveBeenCalled()
    expect(noteFile.write()).not.toHaveBeenCalled()
  })
})
