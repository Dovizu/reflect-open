import { describe, expect, it } from 'vitest'
import {
  createTestCalendarEventsService,
  createTestCalendarService,
  createTestLoggerService,
  createTestPlatformService,
  createTestSettingsService,
} from '../testing/index.ts'
import {
  countSelectedCalendars,
  groupCalendarsBySource,
  showsDayEvents,
} from './calendar-events-service.ts'
import type { CalendarEvent, CalendarInfo } from './calendar-service.ts'

const CALENDARS: CalendarInfo[] = [
  { id: 'cal-work', title: 'Work', source: 'Google', color: '#ff0000' },
  { id: 'cal-home', title: 'Home', source: 'iCloud', color: null },
  { id: 'cal-team', title: 'Team', source: 'Google', color: null },
]

function eventAt(day: number, hour: number, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: `evt-${day}-${hour}`,
    calendarId: 'cal-work',
    title: `Meeting at ${hour}`,
    startsAt: new Date(2026, 6, day, hour, 0).getTime(),
    endsAt: new Date(2026, 6, day, hour + 1, 0).getTime(),
    allDay: false,
    recurring: false,
    availability: 'busy',
    canceled: false,
    attendees: [],
    ...overrides,
  }
}

describe('isAvailable', () => {
  it('is the macOS desktop shell only', () => {
    expect(createTestCalendarEventsService().isAvailable()).toBe(true)
    expect(
      createTestCalendarEventsService({
        platform: createTestPlatformService({ isMacosDesktop: false }),
      }).isAvailable(),
    ).toBe(false)
  })
})

describe('reads', () => {
  it('answers the permission state and the calendars of the Mac', async () => {
    const calendar = createTestCalendarService({ status: 'denied', calendars: CALENDARS })
    const service = createTestCalendarEventsService({ calendar })

    await expect(service.authorizationStatus()).resolves.toBe('denied')
    await expect(service.listCalendars()).resolves.toEqual(CALENDARS)
  })

  it('lists the events of the local day from the asked calendars', async () => {
    const morning = eventAt(1, 9)
    const evening = eventAt(1, 22)
    const calendar = createTestCalendarService({
      events: [
        morning,
        evening,
        eventAt(2, 9),
        eventAt(1, 10, { id: 'other-calendar', calendarId: 'cal-home' }),
      ],
    })
    const service = createTestCalendarEventsService({ calendar })

    await expect(service.listDayEvents('2026-07-01', ['cal-work'])).resolves.toEqual([
      morning,
      evening,
    ])
    await expect(service.listDayEvents('2026-07-03', ['cal-work'])).resolves.toEqual([])
  })
})

describe('subscribeChanged', () => {
  it('calls the listener on every calendar change until unsubscribed', () => {
    const calendar = createTestCalendarService()
    const service = createTestCalendarEventsService({ calendar })
    let changes = 0

    const unlisten = service.subscribeChanged(() => {
      changes += 1
    })
    calendar.emitChanged()
    calendar.emitChanged()
    unlisten()
    calendar.emitChanged()

    expect(changes).toBe(2)
  })
})

describe('requestAccess', () => {
  it('prompts through the calendar', async () => {
    const calendar = createTestCalendarService({ status: 'notDetermined' })
    const service = createTestCalendarEventsService({ calendar })

    await service.requestAccess()

    expect(calendar.accessRequests()).toBe(1)
    await expect(service.authorizationStatus()).resolves.toBe('fullAccess')
  })

  it('logs a failed request and still resolves', async () => {
    const logger = createTestLoggerService()
    const failure = new Error('prompt timed out')
    const service = createTestCalendarEventsService({
      logger,
      calendar: {
        ...createTestCalendarService(),
        requestAccess: async () => {
          throw failure
        },
      },
    })

    await expect(service.requestAccess()).resolves.toBeUndefined()
    expect(logger.getErrors()).toEqual([
      { message: 'calendar access request failed:', cause: failure },
    ])
  })
})

describe('setEnabled', () => {
  it('switching on persists the setting and requests access', async () => {
    const calendar = createTestCalendarService({ status: 'notDetermined' })
    const settings = createTestSettingsService()
    await settings.whenLoaded()
    const service = createTestCalendarEventsService({ calendar, settings })

    const pending = service.setEnabled(true)
    // The switch flips before the OS prompt settles.
    expect(settings.get().calendarEnabled).toBe(true)

    await expect(pending).resolves.toEqual({ accessRequested: true })
    expect(calendar.accessRequests()).toBe(1)
  })

  it('switching off persists the setting without touching the permission', async () => {
    const calendar = createTestCalendarService()
    const settings = createTestSettingsService({ calendarEnabled: true })
    await settings.whenLoaded()
    const service = createTestCalendarEventsService({ calendar, settings })

    await expect(service.setEnabled(false)).resolves.toEqual({ accessRequested: false })

    expect(settings.get().calendarEnabled).toBe(false)
    expect(calendar.accessRequests()).toBe(0)
  })
})

describe('toggleCalendar', () => {
  it('adds a calendar once, at the end, and removes it again', async () => {
    const settings = createTestSettingsService({ calendarIds: ['cal-work', 'cal-home'] })
    await settings.whenLoaded()
    const service = createTestCalendarEventsService({ settings })

    service.toggleCalendar('cal-team', true)
    expect(settings.get().calendarIds).toEqual(['cal-work', 'cal-home', 'cal-team'])

    service.toggleCalendar('cal-work', true)
    expect(settings.get().calendarIds).toEqual(['cal-home', 'cal-team', 'cal-work'])

    service.toggleCalendar('cal-home', false)
    expect(settings.get().calendarIds).toEqual(['cal-team', 'cal-work'])

    service.toggleCalendar('cal-gone', false)
    expect(settings.get().calendarIds).toEqual(['cal-team', 'cal-work'])
  })
})

describe('showsDayEvents', () => {
  it('needs the integration on and at least one calendar chosen', () => {
    expect(showsDayEvents({ calendarEnabled: true, calendarIds: ['cal-work'] })).toBe(true)
    expect(showsDayEvents({ calendarEnabled: true, calendarIds: [] })).toBe(false)
    expect(showsDayEvents({ calendarEnabled: false, calendarIds: ['cal-work'] })).toBe(false)
  })
})

describe('groupCalendarsBySource', () => {
  it('groups calendars by account in first-seen order', () => {
    expect(groupCalendarsBySource(CALENDARS)).toEqual([
      ['Google', [CALENDARS[0], CALENDARS[2]]],
      ['iCloud', [CALENDARS[1]]],
    ])
    expect(groupCalendarsBySource([])).toEqual([])
  })
})

describe('countSelectedCalendars', () => {
  it('counts only ids the Mac still knows, ignoring stale ones', () => {
    expect(countSelectedCalendars(CALENDARS, ['cal-work', 'cal-gone-1', 'cal-gone-2'])).toBe(1)
    expect(countSelectedCalendars(CALENDARS, [])).toBe(0)
  })
})
