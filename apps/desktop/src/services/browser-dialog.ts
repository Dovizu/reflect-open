import type { DialogService } from '@reflect/app'

class BrowserDialogServiceImpl implements DialogService {
  pickFiles(): Promise<readonly string[] | null> {
    return Promise.resolve(null)
  }

  pickFolder(): Promise<string | null> {
    return Promise.resolve(null)
  }
}

/**
 * Plain-browser dev has no native open panel, so every picker reads as a cancel.
 */
export function createBrowserDialogService(): DialogService {
  return new BrowserDialogServiceImpl()
}
