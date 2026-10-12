import { useSyncExternalStore } from 'react'
import { usePaywallService } from '@/services/use-monetization-services.ts'

/**
 * Whether the user asked to see the paywall. Set from Settings and read where
 * the paywall is decided, which is why it is not component state.
 */
export function usePaywallRequested(): [boolean, (next: boolean) => void] {
  const paywall = usePaywallService()
  return [useSyncExternalStore(paywall.subscribe, paywall.requested), paywall.setRequested]
}
