import { useEffect } from 'react'
import type { FileChange } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Subscribe to the watcher's file-change events (Plan 04b) for the lifetime of
 * the component. Events delivered after teardown are dropped.
 *
 * The subscription follows the handler's identity: memoize the handler over
 * its real dependencies and the hook resubscribes exactly when they change.
 * Pass `null` to disable.
 */
export function useFileChanges(handler: ((changes: FileChange[]) => void) | null): void {
  const { fileChanges } = useAppServices()
  useEffect(() => {
    if (handler === null) {
      return
    }
    let active = true
    const unlisten = fileChanges.subscribe(({ changes }) => {
      if (active) {
        handler(changes)
      }
    })
    return () => {
      active = false
      unlisten()
    }
  }, [fileChanges, handler])
}
