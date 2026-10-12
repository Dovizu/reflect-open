import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { defaultEmbeddingRuntime, type EmbedStatus, type Unlisten } from '@reflect/core'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'

function noop(): void {}

/**
 * The embedding runtime's live status (Plan 09). Polls once on mount, then
 * tracks `embed:status` events; a later mount starts from the last status
 * the runtime observed. Without a bridge semantic features stay in
 * `uninitialized`, which keeps them invisible.
 */
export function useEmbedStatus(): EmbedStatus {
  const bridgeReady = useBridgeReady()
  const runtime = defaultEmbeddingRuntime()
  const subscribe = useCallback(
    (onChange: () => void): Unlisten => (bridgeReady ? runtime.subscribe(onChange) : noop),
    [bridgeReady, runtime],
  )

  const getSnapshot = useCallback(() => runtime.lastStatus(), [runtime])

  useEffect(() => {
    if (bridgeReady) {
      void runtime.status()
    }
  }, [bridgeReady, runtime])

  return useSyncExternalStore(subscribe, getSnapshot)
}
