import { defaultNotePreview } from '@reflect/core'

/** Read an existing note without disturbing its editor session: `NotePreviewService.readExistingNoteSource`. */
export async function readExistingNoteSource(path: string, generation: number): Promise<string> {
  return await defaultNotePreview().readExistingNoteSource(path, generation)
}
