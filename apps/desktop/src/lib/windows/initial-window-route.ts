import { defaultDeepLink, type Route } from '@reflect/core'

export { initialRouteForDeepLink } from '@reflect/core'

/** Record the derived first route (the boot hook, before status flips ready). */
export function setInitialWindowRoute(route: Route): void {
  defaultDeepLink().setInitialWindowRoute(route)
}

/** The derived first route, or null (main window, reload, unresolvable link). */
export function getInitialWindowRoute(): Route | null {
  return defaultDeepLink().getInitialWindowRoute()
}
