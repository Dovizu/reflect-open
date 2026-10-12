import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { PlatformService } from '../app/platform-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { Settings } from '../settings/schema.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import type {
  CalendarAuthorizationStatus,
  CalendarEvent,
  CalendarInfo,
  CalendarService,
} from './calendar-service.ts'
import { dayRange } from './events.ts'

/** What a {@link CalendarEventsService} knows of the calendar permission. */
export interface CalendarEventsState {
  /** The macOS calendar permission state; `null` until the first read. */
  readonly authorization: CalendarAuthorizationStatus | null
}

/**
 * The calendar integration behind the daily note's events panel and the
 * settings field (docs/porting/calendar-meetings-integration.md). Events are
 * fetched live: nothing here is cached, and nothing is indexed.
 */
export interface CalendarEventsService {
  getState: () => CalendarEventsState
  /** Called after the state changes. */
  subscribe: (listener: () => void) => Unlisten
  /**
   * Read the permission state now, again whenever the page turns visible or
   * the calendar reports a change, until the returned function runs. The
   * state changes behind Reflect's back in System Settings. Never prompts.
   */
  watchAuthorization: () => Unlisten
  /** Whether calendar reads can run at all: the macOS desktop shell only. */
  isAvailable(): boolean
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
   * Ask the OS for calendar access, then re-read the permission state.
   * Resolves instantly when the OS already remembers an answer; prompts only
   * on the very first request. Never rejects: a failure is logged, and the
   * permission state is the truth.
   */
  requestAccess(): Promise<void>
  /**
   * Switch the integration on or off. Switching it on also requests access;
   * `accessRequested` then tells the caller to re-read the calendars.
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
  lifecycle: Pick<AppLifecycleService, 'subscribeVisible'>
  logger: LoggerService
}): CalendarEventsService {
  const { calendar, settings, platform, lifecycle, logger } = deps
  const listeners = new Set<() => void>()
  let state: CalendarEventsState = { authorization: null }
  // Bumped by every read, so only the latest one publishes.
  let reads = 0

  async function refreshAuthorization(): Promise<void> {
    reads += 1
    const read = reads
    let authorization: CalendarAuthorizationStatus
    try {
      authorization = await calendar.authorizationStatus()
    } catch (cause) {
      logger.error('calendar authorization read failed:', cause)
      return
    }
    if (read !== reads || authorization === state.authorization) {
      return
    }
    state = { authorization }
    for (const listener of listeners) {
      listener()
    }
  }

  async function requestAccess(): Promise<void> {
    try {
      await calendar.requestAccess()
    } catch (cause) {
      logger.error('calendar access request failed:', cause)
    }
    await refreshAuthorization()
  }

  return {
    getState: () => state,
    subscribe(listener) {
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    watchAuthorization() {
      void refreshAuthorization()
      const stopVisible = lifecycle.subscribeVisible(() => {
        void refreshAuthorization()
      })
      const stopChanged = calendar.subscribeChanged(() => {
        void refreshAuthorization()
      })
      return () => {
        stopVisible()
        stopChanged()
      }
    },
    isAvailable: () => platform.isMacosDesktop,
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
