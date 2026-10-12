import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ImageUrlResolver, WikiEmbedResolver } from '@meowdown/core'
import type { AttachmentService } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/** How one note's images, `![[embeds]]`, and attachment links render. */
export interface NoteAttachments {
  /**
   * The graph-relative attachment a link or image destination names (the
   * path to display and open), or null for URLs, notes, and unsafe paths.
   * Reads the catalog as loaded so far.
   */
  resolveAttachmentPath: (destination: string) => string | null
  /**
   * A displayable URL for an image source: http(s) as-is, a local attachment
   * as a generation-pinned `reflect-asset://` URL. Answers synchronously once
   * the catalog is loaded and waits for it before that.
   */
  resolveImageUrl: ImageUrlResolver
  /** Classifies an Obsidian `![[target]]` embed. */
  resolveWikiEmbed: WikiEmbedResolver
}

/** Attachment resolution for rendering `notePath` in graph session `generation`. */
export function createNoteAttachments(
  generation: number | null,
  notePath: string,
  attachments: AttachmentService,
): NoteAttachments {
  return {
    resolveAttachmentPath: (destination) =>
      attachments.resolveAttachmentPath(notePath, destination, generation),
    resolveImageUrl: (source) => attachments.resolveImageUrl(notePath, source, generation),
    resolveWikiEmbed: ({ target }) => attachments.resolveWikiEmbed(target),
  }
}

/**
 * {@link createNoteAttachments} memoized per note and graph session. The
 * caller re-renders whenever the catalog changes.
 */
export function useNoteAttachments(generation: number | null, notePath: string): NoteAttachments {
  const { attachments } = useAppServices()
  const subscribeCatalog = useCallback(
    (listener: () => void) => attachments.onCatalogChanged(listener),
    [attachments],
  )
  useSyncExternalStore(subscribeCatalog, () =>
    generation === null ? null : attachments.peekCatalog(generation),
  )
  return useMemo(
    () => createNoteAttachments(generation, notePath, attachments),
    [attachments, generation, notePath],
  )
}
