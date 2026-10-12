import { defaultNotePath, type NotePathService } from './note-path-service.ts'

export const availableTemplatePath: NotePathService['availableTemplatePath'] = (...args) =>
  defaultNotePath().availableTemplatePath(...args)

export const templateSlugPathForTitle: NotePathService['templateSlugPathForTitle'] = (...args) =>
  defaultNotePath().templateSlugPathForTitle(...args)

export const slugPathForTitle: NotePathService['slugPathForTitle'] = (...args) =>
  defaultNotePath().slugPathForTitle(...args)
