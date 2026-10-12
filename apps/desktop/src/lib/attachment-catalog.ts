import { useEffect } from 'react'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Keeps the open graph session's attachment catalog loaded and fresh while
 * mounted: see `AttachmentService.watchCatalog`.
 */
export function useAttachmentCatalogSync(generation: number | null): void {
  const { attachments } = useAppServices()
  useEffect(
    () => (generation === null ? undefined : attachments.watchCatalog(generation)),
    [attachments, generation],
  )
}
