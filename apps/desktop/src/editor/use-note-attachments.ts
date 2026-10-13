import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ImageUrlResolver, WikiEmbedResolver } from '@meowdown/core'
import type { AttachmentService, GraphInfo } from '@reflect/core'
import { useMaybeGraph } from '@/providers/graph-provider.tsx'
import { useCoreServices } from '@/services/services-provider.tsx'

/**
 * How one note's images, `![[embeds]]`, and attachment links render.
 */
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
  /**
   * Classifies an Obsidian `![[target]]` embed.
   */
  resolveWikiEmbed: WikiEmbedResolver
}

/**
 * Attachment resolution for rendering `notePath` in the open `graph`; only a
 * remote image resolves while no graph is open.
 */
export function createNoteAttachments(
  graph: GraphInfo | null,
  notePath: string,
  attachments: AttachmentService,
): NoteAttachments {
  return {
    resolveAttachmentPath: (destination) =>
      graph === null ? null : attachments.resolveAttachmentPath(notePath, destination),
    resolveImageUrl: (source) => attachments.resolveImageUrl(notePath, source),
    resolveWikiEmbed: ({ target }) => attachments.resolveWikiEmbed(target),
  }
}

/**
 * {@link createNoteAttachments} memoized per note and open graph: an image
 * URL carries the graph's generation, so a reopened graph gets new resolvers.
 * The caller re-renders whenever the catalog changes.
 */
export function useNoteAttachments(notePath: string): NoteAttachments {
  const graph = useMaybeGraph()?.graph ?? null
  const { attachments } = useCoreServices()
  const subscribeCatalog = useCallback(
    (listener: () => void) => attachments.onCatalogChanged(listener),
    [attachments],
  )
  useSyncExternalStore(subscribeCatalog, () => attachments.peekCatalog())
  return useMemo(
    () => createNoteAttachments(graph, notePath, attachments),
    [attachments, graph, notePath],
  )
}
