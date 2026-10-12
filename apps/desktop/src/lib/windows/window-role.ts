import { defaultWindow } from '@reflect/core'

/**
 * Which window this webview is: the main window (the config-declared `main`
 * label — also what plain-browser dev and mobile report) or a secondary
 * `note-*` window opened by a modifier click or command.
 *
 * Secondary windows *adopt* the main window's graph session and run none of
 * the app-wide singletons — the index writer, sync/backup, the capture
 * drain, transcription and embedding reconcilers, update checks, and the OS
 * deep-link intake all belong to the main window. Every such gate funnels
 * through this predicate so the ownership rule lives in one place.
 */
export function isMainWindow(): boolean {
  return defaultWindow().isMainWindow()
}

/**
 * Guard for graph-session mutations only the main window may run — opening,
 * switching, or deleting a graph re-roots the shared Rust `GraphState` under
 * every window at once. True in the main window; elsewhere warns and returns
 * false so call sites bail.
 */
export function requireMainWindow(action: string): boolean {
  if (isMainWindow()) {
    return true
  }
  console.warn(`${action} is only available from the main window`)
  return false
}
