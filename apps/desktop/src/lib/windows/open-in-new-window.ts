import { defaultLinkNavigation } from '@reflect/core'
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

/** Open `route` in a secondary note window: `LinkNavigationService.openRouteInNewWindow`. */
export async function openRouteInNewWindow(route: Route): Promise<boolean> {
  return await defaultLinkNavigation().openRouteInNewWindow(route)
}

/** Open an in-note `reflect://` link in a secondary window: `LinkNavigationService.openDeepLinkInNewWindow`. */
export async function openDeepLinkInNewWindow(href: string): Promise<boolean> {
  return await defaultLinkNavigation().openDeepLinkInNewWindow(href)
}
