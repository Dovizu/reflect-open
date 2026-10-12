import { afterEach, beforeEach, vi, type Mock } from 'vitest'
import {
  isOstensiblyEmptyNoteSource,
  setDefaultNoteDocuments,
  type NoteDocumentService,
} from '@reflect/core'

export interface TestNoteDocuments {
  /** The spy behind `readSource` and `readExisting`. */
  readSource: Mock<NoteDocumentService['readSource']>
  /** The spy behind `commitFrontmatter`. */
  commitFrontmatter: Mock<NoteDocumentService['commitFrontmatter']>
}

/**
 * Install a spied `NoteDocumentService` as the process-wide default for every
 * test of the calling file. Before each test the spies are reset: reads
 * resolve `options.source` (an empty note by default) and commits resolve.
 * Call it at the top level of a test file.
 */
export function installTestNoteDocuments(options?: { source?: string }): TestNoteDocuments {
  const source = options?.source ?? ''
  const readSource = vi.fn<NoteDocumentService['readSource']>()
  const commitFrontmatter = vi.fn<NoteDocumentService['commitFrontmatter']>()

  beforeEach(() => {
    readSource.mockReset().mockResolvedValue(source)
    commitFrontmatter.mockReset().mockResolvedValue(undefined)
    setDefaultNoteDocuments({
      readSource,
      readExisting: async (path) => await readSource(path),
      commitFrontmatter,
      isOstensiblyEmpty: isOstensiblyEmptyNoteSource,
    })
  })

  afterEach(() => {
    setDefaultNoteDocuments(null)
  })

  return { readSource, commitFrontmatter }
}
