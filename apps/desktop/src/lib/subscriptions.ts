/**
 * Collects unlisten/dispose functions and guarantees none leak past disposal:
 * a subscription tracked after {@link SubscriptionTracker.disposeAll} ran is
 * torn down on the spot.
 */
export interface SubscriptionTracker {
  /** Track an already-acquired dispose function. */
  track: (dispose: () => void) => void
  /**
   * Tear everything down; later `track`s dispose immediately.
   */
  disposeAll: () => void
}

/** Create an empty tracker (one per effect run; dispose in the cleanup). */
export function trackSubscriptions(): SubscriptionTracker {
  let disposed = false
  const disposers: Array<() => void> = []
  return {
    track: (dispose) => {
      if (disposed) {
        dispose()
      } else {
        disposers.push(dispose)
      }
    },
    disposeAll: () => {
      disposed = true
      for (const dispose of disposers) {
        dispose()
      }
      disposers.length = 0
    },
  }
}
