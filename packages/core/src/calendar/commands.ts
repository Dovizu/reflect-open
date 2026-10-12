import type { Unlisten } from '../ipc/ipc-service.ts'
import {
  defaultCalendar,
  type CalendarAuthorizationStatus,
  type CalendarEvent,
  type CalendarInfo,
} from './calendar-service.ts'

/**
 * Bindings for the Rust calendar capability over the default
 * `CalendarService`, plus the permission policy.
 */

export {
  calendarAttendeeSchema,
  calendarAuthorizationStatusSchema,
  calendarEventSchema,
  calendarInfoSchema,
  type CalendarAttendee,
  type CalendarAuthorizationStatus,
  type CalendarEvent,
  type CalendarInfo,
} from './calendar-service.ts'

/** True when events can actually be read under `status`. */
export function canReadCalendars(status: CalendarAuthorizationStatus): boolean {
  return status === 'fullAccess'
}

/** The current calendar permission state (never prompts). */
export async function calendarAuthorizationStatus(): Promise<CalendarAuthorizationStatus> {
  return await defaultCalendar().authorizationStatus()
}

/** See `CalendarService.requestAccess`. */
export async function requestCalendarAccess(): Promise<boolean> {
  return await defaultCalendar().requestAccess()
}

/** Every event calendar on this Mac, across all accounts. */
export async function listCalendars(): Promise<CalendarInfo[]> {
  return await defaultCalendar().listCalendars()
}

/** See `CalendarService.listEvents`; `start` and `end` are epoch milliseconds. */
export async function listCalendarEvents(
  start: number,
  end: number,
  calendarIds: string[],
): Promise<CalendarEvent[]> {
  return await defaultCalendar().listEvents({ start, end }, calendarIds)
}

/** See `CalendarService.subscribeChanged`. */
export async function subscribeCalendarChanged(handler: () => void): Promise<Unlisten> {
  return defaultCalendar().subscribeChanged(handler)
}
