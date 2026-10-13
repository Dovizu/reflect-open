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
export { deepLinkForRoute } from './navigation/deep-link-format.ts'
export {
  initialRouteForDeepLink,
  isDeepLinkUrl,
  parseDeepLink,
} from './navigation/deep-link-parse.ts'
export { type DeepLinkService, type DeepLinkSource } from './navigation/deep-link-service.ts'
export {
  routeForTag,
  type LinkNavigationHost,
  type LinkNavigationService,
} from './navigation/link-navigation-service.ts'
export { type NavigateOptions, type NavigationService } from './navigation/navigation-service.ts'
export {
  effectiveDailyDate,
  focusedNotePathForRoute,
  normalizeRoute,
  notePathForRoute,
  routeForPath,
  routesEqual,
  type NoteRoute,
  type Route,
} from './navigation/route.ts'
