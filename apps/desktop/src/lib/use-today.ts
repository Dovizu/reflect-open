import { useCallback, useSyncExternalStore } from 'react'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Today's ISO date as **live** state: re-renders when the local date changes.
 */
export function useToday(): string {
  const { clock } = useAppServices()
  const subscribe = useCallback(
    (listener: () => void) =>
      clock.subscribeToday(() => {
        listener()
      }),
    [clock],
  )
  const getSnapshot = useCallback(() => clock.today(), [clock])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
