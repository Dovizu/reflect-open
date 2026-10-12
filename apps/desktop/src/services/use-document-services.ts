import {
  defaultClock,
  defaultNoteSessions,
  defaultOpenDocuments,
  type ClockService,
  type NoteSessionService,
  type OpenDocumentsService,
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

export function useClockService(): ClockService {
  return useOptionalAppServices()?.clock ?? defaultClock()
}
