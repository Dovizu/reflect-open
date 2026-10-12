import {
  defaultNoteSessions,
  defaultOpenDocuments,
  defaultTitleRename,
  type NoteSessionService,
  type OpenDocumentsService,
  type TitleRenameService,
} from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/*
 * Each hook reads the service from the nearest `AppServicesProvider`, else
 * the process-wide default.
 */

export function useNoteSessionService(): NoteSessionService {
  return useOptionalAppServices()?.noteSessions ?? defaultNoteSessions()
}

export function useOpenDocumentsService(): OpenDocumentsService {
  return useOptionalAppServices()?.openDocuments ?? defaultOpenDocuments()
}

export function useTitleRenameService(): TitleRenameService {
  return useOptionalAppServices()?.titleRename ?? defaultTitleRename()
}
