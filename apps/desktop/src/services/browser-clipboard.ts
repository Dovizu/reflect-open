import type { ClipboardService } from '@reflect/core'

/**
 * The web clipboard API, which the Tauri webview also provides.
 */
export function createNavigatorClipboardService(): ClipboardService {
  return {
    writeText: (text) => navigator.clipboard.writeText(text),
  }
}
