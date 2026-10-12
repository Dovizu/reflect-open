import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestAppServices, type TestAppServices } from '@reflect/core/testing'
import { deleteOpenNote } from './note-delete.ts'

let app: TestAppServices

beforeEach(() => {
  app = createTestAppServices()
})

afterEach(() => {
  app.database.close()
})

describe('deleteOpenNote', () => {
  it('moves the note to the trash', async () => {
    app.noteFile.set('notes/keep.md', '# Keep\n')

    await deleteOpenNote(app, 'notes/keep.md', 7)

    expect(app.noteFile.trashed()).toEqual(['notes/keep.md'])
  })

  it('rejects with the cause when the note cannot be trashed', async () => {
    await expect(deleteOpenNote(app, 'daily/2026-06-15.md', 7)).rejects.toThrow(
      'Daily notes cannot be deleted',
    )

    expect(app.noteFile.trashed()).toEqual([])
  })
})
