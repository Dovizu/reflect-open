import { defaultClock } from '@reflect/core'

/**
 * Today's local calendar date as an external store for `useSyncExternalStore`,
 * backed by the default `ClockService`.
 */

export function subscribeToday(listener: () => void): () => void {
  return defaultClock().subscribeToday(() => {
    listener()
  })
}

export function getTodaySnapshot(): string {
  return defaultClock().today()
}
