import { defaultLinkNavigation, type LinkNavigationService } from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/** The `LinkNavigationService` of the nearest `AppServicesProvider`, else the process-wide one. */
export function useLinkNavigationService(): LinkNavigationService {
  return useOptionalAppServices()?.linkNavigation ?? defaultLinkNavigation()
}
