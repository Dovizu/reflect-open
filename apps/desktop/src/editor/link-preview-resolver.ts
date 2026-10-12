import type { LinkPreviewResolver } from '@meowdown/core'
import {
  cloudSafeLinkHref,
  createLinkPreviewService,
  defaultLinkPreview,
  notePrivate,
  type LinkPreviewSession,
  type NoteDocumentService,
  type parseLinkPreviewMeta,
  type WebFetchService,
} from '@reflect/core'

/*
 * The privacy-gated link expansion lives in `@reflect/core`
 * (`LinkPreviewService`).
 */

export type { LinkPreviewSession } from '@reflect/core'

/** Injectable boundaries used by the pure, session-scoped resolver pipeline. */
export interface LinkPreviewResolverDependencies {
  /** Read the note's live full markdown through the open-document registry. */
  readonly readSource: NoteDocumentService['readExisting']
  /** Fetch bounded page HTML using a privacy-authorized URL. */
  readonly fetchHtml: WebFetchService['fetchLinkPreviewHtml']
  /** Fetch a bounded raster favicon using a privacy-authorized URL. */
  readonly fetchIcon: WebFetchService['fetchLinkPreviewIcon']
  /** Parse and validate bounded display metadata from the fetched page. */
  readonly parseMetadata: typeof parseLinkPreviewMeta
}

/**
 * Build one editor-session resolver: `LinkPreviewService.createResolver` of
 * the process-wide service, or of a service over `dependencies` when given.
 */
export function createNoteLinkPreviewResolver(
  session: LinkPreviewSession,
  currentSession: () => LinkPreviewSession | null,
  dependencies?: LinkPreviewResolverDependencies,
): LinkPreviewResolver {
  const service =
    dependencies === undefined
      ? defaultLinkPreview()
      : createLinkPreviewService({
          noteDocuments: { readExisting: dependencies.readSource },
          privacy: { notePrivate, cloudSafeLinkHref },
          webFetch: {
            fetchLinkPreviewHtml: dependencies.fetchHtml,
            fetchLinkPreviewIcon: dependencies.fetchIcon,
          },
          parseMetadata: dependencies.parseMetadata,
        })
  return service.createResolver(session, currentSession)
}
