import { defaultNoteDocuments } from '@reflect/core'

/** Read an existing note without disturbing its editor session: `NoteDocumentService.readExisting`. */
export async function readExistingNoteSource(path: string, generation: number): Promise<string> {
  return await defaultNoteDocuments().readExisting(path, generation)
}
