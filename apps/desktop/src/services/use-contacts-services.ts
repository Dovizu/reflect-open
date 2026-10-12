import { defaultMeetings, type MeetingService } from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/** The `MeetingService` of the nearest `AppServicesProvider`, else the process-wide default. */
export function useMeetingService(): MeetingService {
  return useOptionalAppServices()?.meetings ?? defaultMeetings()
}
