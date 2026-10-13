import type { CoreServices } from '@reflect/core'
import {
  createAutocompleteSuggestionService,
  type AutocompleteSuggestionService,
} from './search/autocomplete-suggestion-service.ts'

/**
 * What the host supplies to the app layer: the window, lifecycle, storage,
 * updater, menu and deep-link primitives of one webview.
 */
export interface AppHost {}

/**
 * The app-layer services of one webview, built over the core services.
 */
export interface AppServices {
  /**
   * The editor's `[[` and `#` menus.
   */
  readonly autocompleteSuggestions: AutocompleteSuggestionService
}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  void host
  return {
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
  }
}
