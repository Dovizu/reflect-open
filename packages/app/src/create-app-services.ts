import type { CoreServices } from '@reflect/core'

/**
 * What the host supplies to the app layer: the window, lifecycle, storage,
 * updater, menu and deep-link primitives of one webview.
 */
export interface AppHost {}

/**
 * The app-layer services of one webview, built over the core services.
 */
export interface AppServices {}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  void core
  void host
  return {}
}
