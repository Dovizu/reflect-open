/**
 * `@reflect/app`: the app layer over `@reflect/core`. It knows windows, routes,
 * commands and menus, and nothing about React or Tauri. The desktop app builds
 * it once per webview with `createAppServices(core, host)`.
 */
export { createAppServices, type AppHost, type AppServices } from './create-app-services.ts'
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
