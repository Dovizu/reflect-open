import { defaultDailyNotes, type DailyNoteService } from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/**
 * The `DailyNoteService` of the nearest `AppServicesProvider`, else the
 * process-wide default.
 */
export function useDailyNoteService(): DailyNoteService {
  return useOptionalAppServices()?.dailyNotes ?? defaultDailyNotes()
}
