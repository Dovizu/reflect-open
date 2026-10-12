import {
  defaultAppStoreEnvironment,
  defaultClassicAccess,
  defaultLogger,
  defaultPaywall,
  defaultPlatform,
  defaultSubscription,
  type AppStoreEnvironmentService,
  type ClassicAccessService,
  type LoggerService,
  type PaywallService,
  type PlatformService,
  type SubscriptionService,
} from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/*
 * Each hook reads the service from the nearest `AppServicesProvider`, else
 * the process-wide default.
 */

export function useClassicAccessService(): ClassicAccessService {
  return useOptionalAppServices()?.classicAccess ?? defaultClassicAccess()
}

export function useSubscriptionService(): SubscriptionService {
  return useOptionalAppServices()?.subscription ?? defaultSubscription()
}

export function useAppStoreEnvironmentService(): AppStoreEnvironmentService {
  return useOptionalAppServices()?.appStoreEnvironment ?? defaultAppStoreEnvironment()
}

export function usePaywallService(): PaywallService {
  return useOptionalAppServices()?.paywall ?? defaultPaywall()
}

export function usePlatformService(): PlatformService {
  return useOptionalAppServices()?.platform ?? defaultPlatform()
}

export function useLoggerService(): LoggerService {
  return useOptionalAppServices()?.logger ?? defaultLogger()
}
