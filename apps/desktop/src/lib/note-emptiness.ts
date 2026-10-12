import { defaultNoteDocuments } from '@reflect/core'

/** Whether a note's visible markdown body has no authored content: `NoteDocumentService.isOstensiblyEmpty`. */
export function isOstensiblyEmptyNoteSource(source: string): boolean {
  return defaultNoteDocuments().isOstensiblyEmpty(source)
}
