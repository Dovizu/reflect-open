import { defaultWebFetch, type LinkPreviewHtml } from '../app/web-fetch-service.ts'
import type { CloudSafe } from '../privacy/cloud-safe.ts'

export type { LinkPreviewHtml } from '../app/web-fetch-service.ts'

/**
 * Fetch an HTTP(S) page for an editor link preview. The native transport
 * rejects non-public destinations before each request and redirect.
 */
export async function linkPreviewFetchHtml(url: CloudSafe<string>): Promise<LinkPreviewHtml> {
  return await defaultWebFetch().fetchLinkPreviewHtml(url)
}

/** Fetch and normalize a public raster favicon into a small PNG data URL. */
export async function linkPreviewFetchIcon(url: CloudSafe<string>): Promise<string> {
  return await defaultWebFetch().fetchLinkPreviewIcon(url)
}
