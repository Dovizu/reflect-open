import {
  defaultCalendarEvents,
  defaultContactSuggestions,
  defaultMeetings,
  type CalendarEventsService,
  type ContactSuggestionService,
  type MeetingService,
} from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/** The `MeetingService` of the nearest `AppServicesProvider`, else the process-wide default. */
export function useMeetingService(): MeetingService {
  return useOptionalAppServices()?.meetings ?? defaultMeetings()
}

/** The `CalendarEventsService` of the nearest `AppServicesProvider`, else the process-wide default. */
export function useCalendarEventsService(): CalendarEventsService {
  return useOptionalAppServices()?.calendarEvents ?? defaultCalendarEvents()
}

/** The `ContactSuggestionService` of the nearest `AppServicesProvider`, else the process-wide default. */
export function useContactSuggestionService(): ContactSuggestionService {
  return useOptionalAppServices()?.contactSuggestions ?? defaultContactSuggestions()
}
