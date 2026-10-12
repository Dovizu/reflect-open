import {
  createNavigationService,
  type NavigateOptions,
  type NavigationService,
} from '../navigation/navigation-service.ts'
import type { Route } from '../navigation/route.ts'

export interface TestNavigationServiceOptions {
  /** The route the history starts on; defaults to today. */
  initialRoute?: Route
}

/** One `navigate` call as the caller made it (before route normalization). */
export interface TestNavigateCall {
  route: Route
  options: NavigateOptions | undefined
}

export interface TestNavigationService extends NavigationService {
  /** Every `navigate` call, in order. */
  navigations(): readonly TestNavigateCall[]
}

/** The real {@link NavigationService}, recording each `navigate` call. */
export function createTestNavigationService(
  options?: TestNavigationServiceOptions,
): TestNavigationService {
  const service = createNavigationService({ initialRoute: options?.initialRoute })
  const calls: TestNavigateCall[] = []
  return {
    ...service,
    navigate: (route, navigateOptions) => {
      calls.push({ route, options: navigateOptions })
      service.navigate(route, navigateOptions)
    },
    navigations: () => [...calls],
  }
}
