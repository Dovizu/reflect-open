import { useEffect, useSyncExternalStore } from 'react'
import type { AppStoreEnvironment } from '@reflect/core'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'
import { useAppStoreEnvironmentService } from '@/services/use-monetization-services.ts'

export type { AppStoreEnvironment } from '@reflect/core'

/** The live or startup-seeded App Store install channel, verified once the bridge is ready. */
export function useAppStoreEnvironment(): {
  value: AppStoreEnvironment
  isLoading: boolean
  isError: boolean
  invalidate: VoidFunction
} {
  const environment = useAppStoreEnvironmentService()
  const bridgeReady = useBridgeReady()
  const state = useSyncExternalStore(environment.subscribe, environment.getState)

  useEffect(() => {
    if (bridgeReady) {
      void environment.environment()
    }
  }, [environment, bridgeReady])

  return {
    value: state.value,
    isLoading: state.isLoading,
    isError: state.isError,
    invalidate: environment.invalidate,
  }
}
