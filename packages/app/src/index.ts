/**
 * `@reflect/app`: the app layer over `@reflect/core`. It knows windows, routes,
 * commands and menus, and nothing about React or Tauri. The desktop app builds
 * it once per webview with `createAppServices(core, host)`.
 */
export { createAppServices, type AppHost, type AppServices } from './create-app-services.ts'
export {
  createDisabledExceptionTelemetry,
  type ExceptionErrorHandler,
  type ExceptionErrorInfo,
  type ExceptionRootOptions,
  type ExceptionTelemetryService,
} from './app/exception-telemetry-service.ts'
export {
  createUpdateService,
  type UpdaterAdapter,
  type UpdateService,
  type UpdateState,
} from './app/update-service.ts'
export {
  createThemeService,
  THEME_PREFERENCE_CACHE_KEY,
  type ResolvedTheme,
  type ThemeService,
} from './settings/theme-service.ts'
export { type KeyboardService } from './mobile/keyboard-service.ts'
export { type ShareService } from './mobile/share-service.ts'
export { type MobileSyncStatus, type SyncStatusService } from './sync/sync-status-service.ts'
export {
  createConnectGithubWizardService,
  type ConnectAuthKind,
  type ConnectFinishView,
  type ConnectGithubWizardDeps,
  type ConnectGithubWizardOptions,
  type ConnectGithubWizardService,
  type ConnectWizardStep,
} from './sync/connect-github-wizard-service.ts'
export {
  type AutocompleteSuggestionService,
  type TagMenuItem,
  type WikiLinkMenuItem,
} from './search/autocomplete-suggestion-service.ts'
export {
  buildAutocompleteEntries,
  type AutocompleteEntry,
  type ContactEntryCandidate,
  type EntryOptions,
} from './search/wiki-autocomplete-entries.ts'
export {
  EMPTY_ALL_NOTES_FILTERS,
  buildAllNotesSearch,
  hasActiveFilters,
  pendingTagToken,
  searchPlanFor,
  updatedRangeFilter,
  type AllNotesFilters,
  type NoteFilterRef,
  type PendingTag,
} from './search/all-notes-filters.ts'
