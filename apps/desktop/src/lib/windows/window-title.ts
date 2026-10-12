import { defaultWindow } from '@reflect/core'

/**
 * Set this webview's OS window title. Best-effort and shell-only: browser
 * dev has no window frame, and a failed set must never surface, since the
 * title is chrome, not state. Note windows use it so the Window menu and
 * ⌘-backtick cycling can tell N note windows apart.
 */
export function setWindowTitle(title: string): void {
  defaultWindow().setTitle(title)
}
