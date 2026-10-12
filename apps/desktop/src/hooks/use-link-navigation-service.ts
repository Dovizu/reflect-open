import type { LinkNavigationService } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/** The `LinkNavigationService` of the nearest `AppServicesProvider`. */
export function useLinkNavigationService(): LinkNavigationService {
  return useAppServices().linkNavigation
}
