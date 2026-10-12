import { useSyncExternalStore } from 'react'
import { defaultPlatform } from '@reflect/core'

function subscribe(onChange: () => void): () => void {
  return defaultPlatform().subscribeReducedMotion(onChange)
}

function getSnapshot(): boolean {
  return defaultPlatform().prefersReducedMotion()
}

/**
 * Whether the user prefers reduced motion, live — navigation transitions and
 * gesture settles switch to instant cuts while this is true.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
