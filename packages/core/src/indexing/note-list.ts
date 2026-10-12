import { defaultNoteList, type NoteListService } from './note-list-service.ts'

export type {
  NoteListEntry,
  NoteListOptions,
  NoteTagFacet,
  RecentNoteRow,
  RecentNotesOptions,
} from './note-list-service.ts'

export const listNotes: NoteListService['listNotes'] = (...args) =>
  defaultNoteList().listNotes(...args)

export const listRecentNotes: NoteListService['listRecentNotes'] = (...args) =>
  defaultNoteList().listRecentNotes(...args)

export const listNoteTags: NoteListService['listNoteTags'] = (...args) =>
  defaultNoteList().listNoteTags(...args)
