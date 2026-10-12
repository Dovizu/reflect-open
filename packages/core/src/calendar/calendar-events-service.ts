import { defaultLogger, type LoggerService } from '../app/logger-service.ts'
import { defaultPlatform, type PlatformService } from '../app/platform-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { Settings } from '../settings/schema.ts'
import { defaultSettings, type SettingsService } from '../settings/settings-service.ts'
import {
  defaultCalendar,
  type CalendarAuthorizationStatus,
  type CalendarEvent,
  type CalendarInfo,
  type CalendarService,
} from './calendar-service.ts'
import { dayRange } from './events.ts'

/**
 * The calendar integration behind the daily note's events panel and the
 * settings field (docs/porting/calendar-meetings-integration.md). Events are
 * fetched live: nothing here is cached, and nothing is indexed.
 */
export interface CalendarEventsService {
  /** Whether calendar reads can run at all: the macOS desktop shell only. */
  isAvailable(): boolean
  /** The macOS calendar permission state. Never prompts. */
  authorizationStatus(): Promise<CalendarAuthorizationStatus>
  /** Every calendar on the Mac, for the settings chooser. */
  listCalendars(): Promise<CalendarInfo[]>
  /**
   * The raw events of the local day `date` (ISO `YYYY-MM-DD`) from
   * `calendarIds`. Display policy is `displayEvents`.
   */
  listDayEvents(date: string, calendarIds: readonly string[]): Promise<CalendarEvent[]>
  /**
   * Call `listener` when EventKit reports a change (an edit in Calendar.app,
   * an account sync, a permission flip): live reads instead of v1's
   * ten-minute poll.
   */
  subscribeChanged(listener: () => void): Unlisten
  /**
   * Ask the OS for calendar access. Resolves instantly when the OS already
   * remembers an answer; prompts only on the very first request. Never
   * rejects: a failure is logged, and the permission state is the truth.
   */
  requestAccess(): Promise<void>
  /**
   * Switch the integration on or off. Switching it on also requests access;
   * `accessRequested` then tells the caller to re-read the permission state.
   */
  setEnabled(enabled: boolean): Promise<{ accessRequested: boolean }>
  /** Add `id` to, or remove it from, the calendars the daily note shows. */
  toggleCalendar(id: string, checked: boolean): void
}

/**
 * Does the daily note show events under `settings`? The integration is on and
 * at least one calendar is chosen.
 */
export function showsDayEvents(
  settings: Pick<Settings, 'calendarEnabled' | 'calendarIds'>,
): boolean {
  return settings.calendarEnabled && settings.calendarIds.length > 0
}

/** `calendars` grouped by their account, groups and members in first-seen order. */
export function groupCalendarsBySource(
  calendars: readonly CalendarInfo[],
): Array<[source: string, calendars: CalendarInfo[]]> {
  const bySource = new Map<string, CalendarInfo[]>()
  for (const calendar of calendars) {
    const group = bySource.get(calendar.source)
    if (group) {
      group.push(calendar)
    } else {
      bySource.set(calendar.source, [calendar])
    }
  }
  return [...bySource]
}

/**
 * How many of `calendars` are chosen. Counts only ids the Mac still knows:
 * settings may hold identifiers from since-removed accounts, and "3/2
 * calendars" would be nonsense.
 */
export function countSelectedCalendars(
  calendars: readonly CalendarInfo[],
  calendarIds: readonly string[],
): number {
  return calendars.filter((calendar) => calendarIds.includes(calendar.id)).length
}

export function createCalendarEventsService(deps: {
  calendar: CalendarService
  settings: SettingsService
  platform: PlatformService
  logger: LoggerService
}): CalendarEventsService {
  const { calendar, settings, platform, logger } = deps

  async function requestAccess(): Promise<void> {
    try {
      await calendar.requestAccess()
    } catch (cause) {
      logger.error('calendar access request failed:', cause)
    }
  }

  return {
    isAvailable: () => platform.isMacosDesktop,
    authorizationStatus: () => calendar.authorizationStatus(),
    listCalendars: () => calendar.listCalendars(),
    listDayEvents: (date, calendarIds) => calendar.listEvents(dayRange(date), calendarIds),
    subscribeChanged: (listener) => calendar.subscribeChanged(listener),
    requestAccess,

    async setEnabled(enabled) {
      settings.update({ calendarEnabled: enabled })
      if (!enabled) {
        return { accessRequested: false }
      }
      await requestAccess()
      return { accessRequested: true }
    },

    toggleCalendar(id, checked) {
      settings.updateWith((current) => ({
        calendarIds: checked
          ? [...current.calendarIds.filter((existing) => existing !== id), id]
          : current.calendarIds.filter((existing) => existing !== id),
      }))
    },
  }
}

type CalendarEventsServiceDeps = Parameters<typeof createCalendarEventsService>[0]

let installedService: CalendarEventsService | null = null
let fallback: { service: CalendarEventsService; deps: CalendarEventsServiceDeps } | null = null

/**
 * The process-wide `CalendarEventsService`; one over the default calendar,
 * settings, platform and logger unless {@link setDefaultCalendarEvents}
 * installed another.
 */
export function defaultCalendarEvents(): CalendarEventsService {
  if (installedService !== null) {
    return installedService
  }
  const deps: CalendarEventsServiceDeps = {
    calendar: defaultCalendar(),
    settings: defaultSettings(),
    platform: defaultPlatform(),
    logger: defaultLogger(),
  }
  if (
    fallback?.deps.calendar !== deps.calendar ||
    fallback.deps.settings !== deps.settings ||
    fallback.deps.platform !== deps.platform ||
    fallback.deps.logger !== deps.logger
  ) {
    fallback = { service: createCalendarEventsService(deps), deps }
  }
  return fallback.service
}

/**
 * Install the process-wide `CalendarEventsService`; `null` restores the one
 * over the default services.
 */
export function setDefaultCalendarEvents(service: CalendarEventsService | null): void {
  installedService = service
}
