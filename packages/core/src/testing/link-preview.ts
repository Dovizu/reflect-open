import type { WebFetchService } from '../app/web-fetch-service.ts'
import type { NoteDocumentService } from '../documents/note-document-service.ts'
import {
  createLinkPreviewService,
  type LinkPreviewService,
} from '../link-preview/link-preview-service.ts'
import { parseLinkPreviewMeta } from '../link-preview/metadata.ts'
import type { PrivacyService } from '../privacy/privacy-service.ts'
import { createTestWebFetchService } from './capture.ts'
import { createTestNoteDocumentService } from './documents.ts'
import { createTestPrivacyService } from './privacy.ts'

export interface TestLinkPreviewServiceOptions {
  /** Defaults to the real service over empty test doubles. */
  noteDocuments?: Pick<NoteDocumentService, 'readExisting'>
  privacy?: Pick<PrivacyService, 'notePrivate' | 'cloudSafeLinkHref'>
  /** Defaults to a {@link createTestWebFetchService} with no answers. */
  webFetch?: Pick<WebFetchService, 'fetchLinkPreviewHtml' | 'fetchLinkPreviewIcon'>
  /** Defaults to the real parser, which needs a `DOMParser`. */
  parseMetadata?: typeof parseLinkPreviewMeta
}

/** The real {@link LinkPreviewService} over test doubles (fresh ones by default). */
export function createTestLinkPreviewService(
  options?: TestLinkPreviewServiceOptions,
): LinkPreviewService {
  return createLinkPreviewService({
    noteDocuments: options?.noteDocuments ?? createTestNoteDocumentService(),
    privacy: options?.privacy ?? createTestPrivacyService(),
    webFetch: options?.webFetch ?? createTestWebFetchService(),
    parseMetadata: options?.parseMetadata ?? parseLinkPreviewMeta,
  })
}
