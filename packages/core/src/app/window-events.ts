import type { Unlisten } from '../ipc/ipc-service.ts'
import { defaultWindow } from './window-service.ts'

/**
 * Events the shell targets at one specific window (`emit_to`), as opposed to
 * the app-wide broadcasts in the indexing modules.
 */

/**
 * Delivered to an existing note window when its target is ⌘-clicked again:
 * the window may have navigated elsewhere, so the shell focuses it AND sends
 * the original deep link to re-navigate it to the clicked note.
 */
export { WINDOW_NAVIGATE_EVENT } from './window-service.ts'

/** Subscribe to shell-directed navigation requests (`reflect://` links). */
export function subscribeWindowNavigate(handler: (url: string) => void): Unlisten {
  return defaultWindow().subscribeNavigate(handler)
}
