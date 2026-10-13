import type { CoreServices } from '@reflect/core'
import {
  createDisabledExceptionTelemetry,
  type ExceptionTelemetryService,
} from './app/exception-telemetry-service.ts'
import {
  createUpdateService,
  type UpdaterAdapter,
  type UpdateService,
} from './app/update-service.ts'
import { createThemeService, type ThemeService } from './settings/theme-service.ts'
import { createKeyboardService, type KeyboardService } from './mobile/keyboard-service.ts'
import { createShareService, type ShareService } from './mobile/share-service.ts'
import { createSyncStatusService, type SyncStatusService } from './sync/sync-status-service.ts'
import {
  createAutocompleteSuggestionService,
  type AutocompleteSuggestionService,
} from './search/autocomplete-suggestion-service.ts'
import {
  createCalendarEventsService,
  type CalendarEventsService,
} from './calendar/calendar-events-service.ts'

/**
 * What the host supplies to the app layer: the window, lifecycle, storage,
 * updater, menu and deep-link primitives of one webview.
 */
export interface AppHost {
  /**
   * Defaults to telemetry that reports nothing.
   */
  readonly exceptionTelemetry?: ExceptionTelemetryService
  /**
   * The native updater; without one, updates are unsupported.
   */
  readonly updater?: UpdaterAdapter
}

/**
 * The app-layer services of one webview, built over the core services.
 */
export interface AppServices {
  /**
   * Exception-only crash reporting.
   */
  readonly exceptionTelemetry: ExceptionTelemetryService
  /**
   * The app theme: the `theme` setting resolved against the system color scheme.
   */
  readonly theme: ThemeService
  /**
   * Checks for, downloads, and installs app updates.
   */
  readonly update: UpdateService
  /**
   * Derives the mobile sync status that the settings sheet and the status pill show.
   */
  readonly syncStatus: SyncStatusService
  /**
   * The software keyboard's overlap height, as the UI last measured it.
   */
  readonly keyboard: KeyboardService
  /**
   * Shares a note through the OS share sheet.
   */
  readonly share: ShareService
  /**
   * The editor's `[[` and `#` menus.
   */
  readonly autocompleteSuggestions: AutocompleteSuggestionService
  /**
   * The calendar events behind the daily note's events panel, fetched live.
   */
  readonly calendarEvents: CalendarEventsService
}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  return {
    exceptionTelemetry: host.exceptionTelemetry ?? createDisabledExceptionTelemetry(),
    theme: createThemeService({
      settings: core.settings,
      storage: core.storage,
      platform: core.platform,
    }),
    update: createUpdateService({
      updater: host.updater,
      clock: core.clock,
      logger: core.logger,
      platform: core.platform,
      window: core.window,
    }),
    syncStatus: createSyncStatusService(),
    keyboard: createKeyboardService(),
    share: createShareService({ openDocuments: core.openDocuments }),
    autocompleteSuggestions: createAutocompleteSuggestionService({
      suggestions: core.suggestions,
      noteCreation: core.noteCreation,
      contacts: core.contacts,
      personNotes: core.personNotes,
      settings: core.settings,
      clock: core.clock,
      operations: core.operations,
      logger: core.logger,
      graphSession: core.graphSession,
    }),
    calendarEvents: createCalendarEventsService({
      calendar: core.calendar,
      settings: core.settings,
      platform: core.platform,
      lifecycle: core.lifecycle,
      logger: core.logger,
    }),
  }
}
