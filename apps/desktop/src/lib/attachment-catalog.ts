import { useEffect } from 'react'
import { useAttachments } from '@/editor/use-note-attachments.ts'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'

/**
 * Keeps the open graph session's attachment catalog loaded and fresh while
 * mounted: see `AttachmentService.watchCatalog`.
 */
export function useAttachmentCatalogSync(generation: number | null): void {
  const attachments = useAttachments()
  const bridgeReady = useBridgeReady()
  useEffect(
    () => (!bridgeReady || generation === null ? undefined : attachments.watchCatalog(generation)),
    [attachments, bridgeReady, generation],
  )
}
