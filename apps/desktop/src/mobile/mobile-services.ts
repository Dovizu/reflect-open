import type { AppServices } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

type MobileOnlyService =
  | 'haptics'
  | 'subscription'
  | 'appStoreEnvironment'
  | 'paywall'
  | 'mobileAudioMemo'

/** {@link AppServices} with the services that only a mobile platform builds. */
export type MobileAppServices = AppServices & Required<Pick<AppServices, MobileOnlyService>>

/**
 * `useAppServices()` for the mobile surface tree. `AppServices` types the
 * mobile-only services as optional, because desktop does not build them. The
 * mobile tree runs only on a mobile platform, where they always exist.
 */
export function useMobileAppServices(): MobileAppServices {
  return useAppServices() as MobileAppServices
}
