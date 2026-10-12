import type {
  CalendarAuthorizationStatus,
  CalendarEvent,
  CalendarInfo,
  CalendarService,
} from '../calendar/calendar-service.ts'

export interface TestCalendarServiceOptions {
  /** The permission state. Defaults to `fullAccess`. */
  status?: CalendarAuthorizationStatus
  /** Whether the permission prompt grants access. Defaults to `true`. */
  grantAccess?: boolean
  calendars?: readonly CalendarInfo[]
  events?: readonly CalendarEvent[]
}

export interface TestCalendarService extends CalendarService {
  setStatus(status: CalendarAuthorizationStatus): void
  setCalendars(calendars: readonly CalendarInfo[]): void
  setEvents(events: readonly CalendarEvent[]): void
  /** Notify every `subscribeChanged` listener. */
  emitChanged(): void
  /** How many times `requestAccess` ran. */
  accessRequests(): number
}

/**
 * An in-memory {@link CalendarService}. `listEvents` answers the events on
 * the asked calendars that overlap the range. Like the OS, `requestAccess`
 * prompts only while the status is `notDetermined`.
 */
export function createTestCalendarService(
  options?: TestCalendarServiceOptions,
): TestCalendarService {
  let status = options?.status ?? 'fullAccess'
  let calendars = [...(options?.calendars ?? [])]
  let events = [...(options?.events ?? [])]
  const grantAccess = options?.grantAccess ?? true
  let requests = 0
  const listeners = new Set<() => void>()

  return {
    authorizationStatus: async () => status,
    requestAccess: async () => {
      requests++
      if (status === 'notDetermined') {
        status = grantAccess ? 'fullAccess' : 'denied'
      }
      return status === 'fullAccess'
    },
    listCalendars: async () => [...calendars],
    listEvents: async (range, calendarIds) =>
      events.filter(
        (event) =>
          calendarIds.includes(event.calendarId) &&
          event.startsAt <= range.end &&
          event.endsAt >= range.start,
      ),
    subscribeChanged: (listener) => {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    setStatus(next) {
      status = next
    },
    setCalendars(next) {
      calendars = [...next]
    },
    setEvents(next) {
      events = [...next]
    },
    emitChanged() {
      for (const listener of listeners) {
        listener()
      }
    },
    accessRequests: () => requests,
  }
}
