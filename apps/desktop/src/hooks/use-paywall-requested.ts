import { useSyncExternalStore } from 'react'
import { useMobileAppServices } from '@/mobile/mobile-services.ts'

/**
 * Whether the user asked to see the paywall. Set from Settings and read where
 * the paywall is decided, which is why it is not component state.
 */
export function usePaywallRequested(): [boolean, (next: boolean) => void] {
  const { paywall } = useMobileAppServices()
  return [useSyncExternalStore(paywall.subscribe, paywall.requested), paywall.setRequested]
}
