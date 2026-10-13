import type { CoreServices } from '@reflect/core'
import type { ClipboardService } from './app/clipboard-service.ts'
import {
  createOpenerService,
  type OpenerService,
  type OpenerTransport,
} from './app/opener-service.ts'
import { createCommandService, type CommandService } from './commands/command-service.ts'
import { createKeymapService, type KeymapService } from './commands/keymap-service.ts'
import {
  createNativeMenuService,
  createUnsupportedNativeMenuHost,
  type NativeMenuHost,
  type NativeMenuService,
} from './commands/native-menu-service.ts'
import {
  createPaletteSearchService,
  type PaletteSearchService,
} from './search/palette-search-service.ts'
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
import { createDeepLinkRouter, type DeepLinkRouter } from './navigation/deep-link-router.ts'
import {
  createLinkNavigationService,
  type LinkNavigationService,
} from './navigation/link-navigation-service.ts'
import { createNavigationService, type NavigationService } from './navigation/navigation-service.ts'

/**
 * What the host supplies to the app layer: the window, lifecycle, storage,
 * updater, menu and deep-link primitives of one webview.
 */
export interface AppHost {
  /**
   * The system clipboard.
   */
  readonly clipboard: ClipboardService
  /**
   * The native operations behind the opener service.
   */
  readonly opener: OpenerTransport
  /**
   * Defaults to telemetry that reports nothing.
   */
  readonly exceptionTelemetry?: ExceptionTelemetryService
  /**
   * The native updater; without one, updates are unsupported.
   */
  readonly updater?: UpdaterAdapter
  /**
   * The native menus; without a host, every menu operation rejects.
   */
  readonly nativeMenu?: NativeMenuHost
}

/**
 * The app-layer services of one webview, built over the core services.
 */
export interface AppServices {
  /**
   * The system clipboard.
   */
  readonly clipboard: ClipboardService
  /**
   * Hands URLs and paths to the operating system.
   */
  readonly opener: OpenerService
  /**
   * The central keymap registry that rejects duplicate shortcut bindings.
   */
  readonly keymap: KeymapService
  /**
   * The command registry. The app decides the context type that its commands run with.
   */
  readonly commands: CommandService
  /**
   * The native macOS application menu and native context menus.
   */
  readonly nativeMenu: NativeMenuService
  /**
   * The command palette's data layer.
   */
  readonly paletteSearch: PaletteSearchService
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
  /**
   * The webview's navigation history; a note window has its own webview, hence its own.
   */
  readonly navigation: NavigationService
  /**
   * Turns the `reflect://` URLs of this webview into navigations.
   */
  readonly deepLinkRouter: DeepLinkRouter
  /**
   * Turns an activated link into a navigation, a new window, or a refusal.
   */
  readonly linkNavigation: LinkNavigationService
}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  const commands = createCommandService({ platform: core.platform, logger: core.logger })
  const keymap = createKeymapService({ platform: core.platform })
  const nativeMenu = createNativeMenuService({
    commands,
    window: core.window,
    platform: core.platform,
    ipc: core.ipc,
    logger: core.logger,
    host: host.nativeMenu ?? createUnsupportedNativeMenuHost(),
  })
  const paletteSearch = createPaletteSearchService({
    suggestions: core.suggestions,
    search: core.search,
    retrieval: core.retrieval,
    commands,
    clock: core.clock,
  })
  const opener = createOpenerService({ transport: host.opener, logger: core.logger })
  const navigation = createNavigationService()
  const deepLinkRouter = createDeepLinkRouter({
    intake: core.deepLinkIntake,
    logger: core.logger,
    graphSession: core.graphSession,
  })
  const linkNavigation = createLinkNavigationService({
    noteLinkResolver: core.noteLinkResolver,
    noteCreation: core.noteCreation,
    wikiResolver: core.wikiResolver,
    window: core.window,
    platform: core.platform,
    opener,
    deepLinkRouter,
    navigation,
    attachments: core.attachments,
    operations: core.operations,
    logger: core.logger,
    graphSession: core.graphSession,
  })
  return {
    clipboard: host.clipboard,
    opener,
    commands,
    keymap,
    nativeMenu,
    paletteSearch,
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
    navigation,
    deepLinkRouter,
    linkNavigation,
  }
}
