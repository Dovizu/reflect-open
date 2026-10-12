import { defaultLifecycle } from '@reflect/core'

/**
 * Call `onResume` when the user comes back to this window or the network comes
 * back. Returns the disposer.
 */
export function attachResumeListeners(onResume: () => void): () => void {
  return defaultLifecycle().subscribeResume(onResume)
}
