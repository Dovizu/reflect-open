import { describe, expect, it } from 'vitest'
import { installTestNoteFile } from '@/test-utils/note-file.ts'
import { installTestOpenDocuments } from '@/test-utils/open-documents.ts'
import { deleteOpenNote } from './note-delete.ts'

installTestOpenDocuments()
const noteFile = installTestNoteFile()

describe('deleteOpenNote', () => {
  it('moves the note to the trash', async () => {
    noteFile.service().set('notes/keep.md', '# Keep\n')

    await deleteOpenNote('notes/keep.md', 7)

    expect(noteFile.service().trashed()).toEqual(['notes/keep.md'])
  })

  it('rejects with the cause when the note cannot be trashed', async () => {
    await expect(deleteOpenNote('daily/2026-06-15.md', 7)).rejects.toThrow(
      'Daily notes cannot be deleted',
    )

    expect(noteFile.service().trashed()).toEqual([])
  })
})
