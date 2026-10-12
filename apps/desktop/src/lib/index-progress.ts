import { defaultIndexLifecycle, type IndexFileProgress } from '@reflect/core'

/**
 * Live progress of the active index pass, published outside the graph
 * context on purpose: progress ticks arrive several times a second during a
 * first index, and pushing them through `GraphProvider` state would re-render
 * every `useGraph` consumer per tick — exactly when the thread is busiest.
 * The status pill subscribes here alone via `useSyncExternalStore`.
 */

/** How far the running pass has advanced through the file listing. */
export type IndexProgress = IndexFileProgress

/** `defaultIndexLifecycle().fileProgress`. */
export function getIndexProgress(): IndexProgress | null {
  return defaultIndexLifecycle().fileProgress()
}

/** `defaultIndexLifecycle().subscribeFileProgress`. */
export function subscribeIndexProgress(listener: () => void): () => void {
  return defaultIndexLifecycle().subscribeFileProgress(listener)
}
