import type { DialogService } from '@reflect/core'

/**
 * Plain-browser dev has no native open panel, so every picker reads as a cancel.
 */
export function createBrowserDialogService(): DialogService {
  return {
    pickFiles: async () => null,
    pickFolder: async () => null,
  }
}
