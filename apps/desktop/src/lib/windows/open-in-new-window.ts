import { defaultWindow } from '@reflect/core'
import { deepLinkForRoute } from '@/lib/deep-links/format.ts'
import { parseDeepLink } from '@/lib/deep-links/parse.ts'
import { isNativeShell } from '@/lib/platform.ts'
import { isMobileSurface } from '@/lib/platform-surface.ts'
import type { Route } from '@/routing/route.ts'

/**
 * Open a target in a secondary note window (Plan 06). Modifier-click callers
 * and the selected-note command resolve a route or an in-note `reflect://`
 * link to the shell's `open_note_window` command. Modifier-click callers fall
 * back to in-window navigation whenever a helper answers false, so the
 * modifier can never make a link do nothing.
 */

/** The modifier fields meowdown's `isModEvent` reads off a link-like control's click. */
export interface ModClickEvent {
  metaKey: boolean
  ctrlKey: boolean
}

/**
 * Open `route` in a secondary note window. False — never a throw — when this
 * surface can't (no shell, mobile, a route the deep-link grammar doesn't
 * name, or a failed command). Modifier-click callers then navigate in place,
 * so the gesture degrades to a plain click instead of doing nothing.
 */
export async function openRouteInNewWindow(route: Route): Promise<boolean> {
  if (!isNativeShell() || isMobileSurface()) {
    return false
  }
  const link = deepLinkForRoute(route)
  if (link === null) {
    return false
  }
  return await defaultWindow().openNoteWindow(link)
}

/**
 * Open an in-note `reflect://` link in a secondary window — only links that
 * *address* something (navigate / openNote). Capture links (append, task)
 * are writes, not places: a modifier click still dispatches them normally.
 * Same false-not-throw contract as {@link openRouteInNewWindow}.
 */
export async function openDeepLinkInNewWindow(href: string): Promise<boolean> {
  if (!isNativeShell() || isMobileSurface()) {
    return false
  }
  const link = parseDeepLink(href)
  if (link === null || link.kind === 'capture') {
    return false
  }
  return await defaultWindow().openNoteWindow(href)
}
