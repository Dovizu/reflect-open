import { useSyncExternalStore } from 'react'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Whether the user prefers reduced motion, live — navigation transitions and
 * gesture settles switch to instant cuts while this is true.
 */
export function usePrefersReducedMotion(): boolean {
  const { platform } = useAppServices()
  return useSyncExternalStore(platform.subscribeReducedMotion, platform.prefersReducedMotion)
}
