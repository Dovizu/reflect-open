import type { CoreServices } from '@reflect/core'
import { createKeyboardService, type KeyboardService } from './mobile/keyboard-service.ts'
import { createShareService, type ShareService } from './mobile/share-service.ts'
import { createSyncStatusService, type SyncStatusService } from './sync/sync-status-service.ts'

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
}

/**
 * Build the app layer once per webview.
 */
export function createAppServices(core: CoreServices, host: AppHost): AppServices {
  void host
  return {
    syncStatus: createSyncStatusService(),
    keyboard: createKeyboardService(),
    share: createShareService({ openDocuments: core.openDocuments }),
  }
}
