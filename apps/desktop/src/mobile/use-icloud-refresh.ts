import { useEffect } from 'react'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

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
  const { icloudDownloads } = useAppServices()

  useEffect(() => {
    if (root === null) {
      return
    }
    const service = icloudDownloads.create({ root, refreshIndex })
    service.start()
    return () => {
      service.dispose()
    }
  }, [icloudDownloads, root, refreshIndex])
}
