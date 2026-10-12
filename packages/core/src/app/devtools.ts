import { defaultWindow } from './window-service.ts'

/**
 * Toggle the native web inspector for the calling window: open it, or close it
 * if it is already open.
 *
 * The Rust shell compiles the inspector into every build (debug and release; see
 * `apps/desktop/src-tauri/src/devtools.rs`), so a shipped app stays debuggable.
 * Hosts without a native shell (plain-browser dev) have no inspector to toggle;
 * callers gate on `hasBridge()` before invoking.
 */
export function toggleDevtools(): Promise<void> {
  return defaultWindow().toggleDevtools()
}
