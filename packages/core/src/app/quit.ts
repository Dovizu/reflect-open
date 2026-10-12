import type { Unlisten } from '../ipc/ipc-service.ts'
import { defaultLifecycle } from './lifecycle-service.ts'

/**
 * The quit-time flush handshake. macOS ⌘Q requests app exit without closing
 * the window first, so the window's close-requested flush never runs; the Rust
 * shell defers that exit once and emits {@link QUIT_REQUESTED_EVENT}, the
 * frontend flushes dirty note buffers, then confirms, and the confirm exits
 * for real.
 */

export { QUIT_REQUESTED_EVENT } from './lifecycle-service.ts'

/** Subscribe to the shell's deferred-quit notification. */
export function subscribeQuitRequested(handler: () => void): Unlisten {
  return defaultLifecycle().subscribeQuitRequested(handler)
}

/**
 * Confirm a deferred quit after flushing. The app exits inside this call, so
 * the returned promise may never settle: fire and forget.
 */
export function confirmQuit(): Promise<void> {
  return defaultLifecycle().confirmQuit()
}
