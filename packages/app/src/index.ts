/**
 * `@reflect/app`: the app layer over `@reflect/core`. It knows windows, routes,
 * commands and menus, and nothing about React or Tauri. The desktop app builds
 * it once per webview with `createAppServices(core, host)`.
 */
export { createAppServices, type AppHost, type AppServices } from './create-app-services.ts'
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
