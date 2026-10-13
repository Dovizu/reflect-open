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
export { type Command, type CommandService } from './commands/command-service.ts'
export { formatBinding } from './commands/keybindings.ts'
export { type KeymapService } from './commands/keymap-service.ts'
export {
  type AppMenuEntry,
  type AppSubmenuLayout,
  type FocusedNoteMenuCommand,
  type NativeContextMenuOptions,
  type NativeMenuHost,
  type NativeMenuItem,
  type NativeMenuPredefinedItem,
  type NativeMenuService,
  type NativeSubmenu,
} from './commands/native-menu-service.ts'
export {
  buildPaletteSections,
  type NoteEntry,
  type PaletteHit,
  type PaletteSections,
} from './search/palette-entries.ts'
export { type PaletteSearchService } from './search/palette-search-service.ts'
