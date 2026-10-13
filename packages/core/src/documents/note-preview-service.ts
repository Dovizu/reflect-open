import type { GraphSessionSource } from '../app/graph-session.ts'
import type { NoteLinkResolverService } from '../graph/note-link-resolver-service.ts'
import { splitFrontmatter } from '../markdown/frontmatter.ts'
import type { AttachmentService, WikiEmbedDisplay } from './attachment-service.ts'
import type { NoteDocumentService } from './note-document-service.ts'

/** A read-only snapshot of one note, taken for a passive preview. */
export interface NotePreview {
  /** The graph-relative path of the previewed note. */
  readonly path: string
  /** The note body with frontmatter already stripped. */
  readonly markdown: string
  /** The preview URL of an image in the note, resolved from the note's own folder. */
  resolveImageUrl: (source: string) => Promise<string | undefined>
  /** Classify one of the note's `![[embeds]]`. */
  resolveWikiEmbed: (target: string) => WikiEmbedDisplay | undefined
}

/** Read-only previews of the note that a link points at. */
export interface NotePreviewService {
  /**
   * The preview of the note that a `[[wiki link]]` target names. Only an
   * existing target resolves to a snapshot; missing, ambiguous, unavailable,
   * and failed targets resolve to `null`, as does any target while no graph is
   * open. Failures are swallowed into `null` rather than rejected: transient
   * read errors (an iCloud eviction, a graph switch) are expected and should
   * not log as errors.
   */
  previewWikiTarget(target: string): Promise<NotePreview | null>
}

export interface NotePreviewServiceDeps {
  noteLinkResolver: Pick<NoteLinkResolverService, 'resolveWikiTarget'>
  noteDocuments: Pick<NoteDocumentService, 'readExisting'>
  attachments: Pick<AttachmentService, 'resolvePreviewImageUrl' | 'resolveWikiEmbed'>
  graphSession: GraphSessionSource
}

export function createNotePreviewService(deps: NotePreviewServiceDeps): NotePreviewService {
  const { noteLinkResolver, noteDocuments, attachments, graphSession } = deps

  return {
    async previewWikiTarget(target) {
      const session = graphSession.getState().session
      if (session === null) {
        return null
      }
      const { generation } = session
      try {
        const resolution = await noteLinkResolver.resolveWikiTarget(target, generation)
        if (resolution.kind !== 'resolved') {
          return null
        }
        const { path } = resolution
        const source = await noteDocuments.readExisting(path, generation)
        return {
          path,
          markdown: splitFrontmatter(source).body,
          resolveImageUrl: (imageSource) =>
            attachments.resolvePreviewImageUrl(path, imageSource, generation),
          resolveWikiEmbed: (embedTarget) => attachments.resolveWikiEmbed(embedTarget),
        }
      } catch {
        return null
      }
    },
  }
}
