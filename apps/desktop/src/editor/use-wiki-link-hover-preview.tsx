import { useCallback, type ReactNode } from 'react'
import type { WikilinkHoverHit } from '@meowdown/core'
import { defaultNotePreview, type DateFormat } from '@reflect/core'
import { WikiLinkHoverPreview } from '@/components/wiki-link-hover-preview.tsx'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

interface WikiLinkHoverPreviewOptions {
  generation: number | null
  graphKey: string | null
  dateFormat: DateFormat
}

/**
 * Build the async body resolver for Meowdown's editor-scoped wiki-link hover
 * card. The whole preview is decided inside the returned promise: an existing
 * target resolves to a passive snapshot body; missing, ambiguous, unavailable,
 * and failed targets resolve to `null`, which renders no card (see
 * `NotePreviewService.previewWikiTarget`).
 */
export function useWikiLinkHoverPreview({
  generation,
  graphKey,
  dateFormat,
}: WikiLinkHoverPreviewOptions): (hit: WikilinkHoverHit) => Promise<ReactNode> {
  const notePreview = useOptionalAppServices()?.notePreview ?? defaultNotePreview()
  return useCallback(
    async ({ target }: WikilinkHoverHit): Promise<ReactNode> => {
      if (generation === null || graphKey === null) {
        return null
      }
      const preview = await notePreview.previewWikiTarget(target, generation)
      if (preview === null) {
        return null
      }
      return (
        <WikiLinkHoverPreview
          path={preview.path}
          markdown={preview.markdown}
          dateFormat={dateFormat}
          resolveImageUrl={preview.resolveImageUrl}
          resolveWikiEmbed={({ target: embedTarget }) => preview.resolveWikiEmbed(embedTarget)}
        />
      )
    },
    [dateFormat, generation, graphKey, notePreview],
  )
}
