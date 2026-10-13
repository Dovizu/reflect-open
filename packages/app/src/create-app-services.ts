import type { CoreServices } from '@reflect/core'
import {
  createCalendarEventsService,
  type CalendarEventsService,
} from './calendar/calendar-events-service.ts'

/**
 * What the host supplies to the app layer: the window, lifecycle, storage,
 * updater, menu and deep-link primitives of one webview.
 */
export interface AppHost {}

/**
 * The app-layer services of one webview, built over the core services.
 */
export interface AppServices {
  readonly calendarEvents: CalendarEventsService
}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  void host
  return {
    calendarEvents: createCalendarEventsService({
      calendar: core.calendar,
      settings: core.settings,
      platform: core.platform,
      lifecycle: core.lifecycle,
      logger: core.logger,
    }),
  }
}
