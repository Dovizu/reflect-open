import { useEffect } from 'react'
import { defaultICloudDownloads } from '@reflect/core'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/**
 * Keeps an iCloud-stored graph fresh while the app is used (Plan 21): mounts
 * core's `ICloudDownloadService` for the open graph, which nudges the pending
 * downloads on open and on every resume, and reconciles the index as they
 * land. All of the behavior lives in the service.
 *
 * Inert unless an iCloud graph is open (`mobileStorageKind === 'icloud'`).
 */
export function useICloudRefresh(): void {
  const { graph, mobileStorageKind, refreshIndex } = useGraph()
  const root = mobileStorageKind === 'icloud' ? (graph?.root ?? null) : null
  const bridgeReady = useBridgeReady()
  const downloads = useOptionalAppServices()?.icloudDownloads

  useEffect(() => {
    if (root === null || !bridgeReady) {
      return
    }
    const service = (downloads ?? defaultICloudDownloads()).create({ root, refreshIndex })
    service.start()
    return () => {
      service.dispose()
    }
  }, [bridgeReady, downloads, root, refreshIndex])
}
