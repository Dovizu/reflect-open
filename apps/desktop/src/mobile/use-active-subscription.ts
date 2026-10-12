import { useEffect, useSyncExternalStore } from 'react'
import { focusManager } from '@tanstack/react-query'
import type { ActiveSubscription } from '@reflect/core'
import { useMobileAppServices } from '@/mobile/use-mobile-app-services.ts'

/**
 * The live or startup-seeded active subscription. Mounting looks it up unless
 * a live answer is fresh; every window focus looks it up again.
 */
export function useActiveSubscription(): {
  value: ActiveSubscription
  isLoading: boolean
  isError: boolean
  invalidate: VoidFunction
  refetch: () => Promise<ActiveSubscription>
} {
  const { subscription } = useMobileAppServices()
  const state = useSyncExternalStore(subscription.subscribe, subscription.getState)

  useEffect(() => {
    void subscription.activeSubscription()
    return focusManager.subscribe((focused) => {
      if (focused) {
        void subscription.refetch()
      }
    })
  }, [subscription])

  return {
    value: state.value,
    isLoading: state.isLoading,
    isError: state.isError,
    invalidate: subscription.invalidate,
    refetch: subscription.refetch,
  }
}
