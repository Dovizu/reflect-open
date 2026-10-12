import { useEffect, useSyncExternalStore } from 'react'
import type { AppStoreEnvironment } from '@reflect/core'
import { useMobileAppServices } from '@/mobile/use-mobile-app-services.ts'

export type { AppStoreEnvironment } from '@reflect/core'

/** The live or startup-seeded App Store install channel, verified on mount. */
export function useAppStoreEnvironment(): {
  value: AppStoreEnvironment
  isLoading: boolean
  isError: boolean
  invalidate: VoidFunction
} {
  const { appStoreEnvironment: environment } = useMobileAppServices()
  const state = useSyncExternalStore(environment.subscribe, environment.getState)

  useEffect(() => {
    void environment.environment()
  }, [environment])

  return {
    value: state.value,
    isLoading: state.isLoading,
    isError: state.isError,
    invalidate: environment.invalidate,
  }
}
