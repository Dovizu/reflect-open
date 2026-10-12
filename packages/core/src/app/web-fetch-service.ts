import { z } from 'zod'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'
import type { CloudSafe } from '../privacy/cloud-safe.ts'

const LINK_PREVIEW_HTML_MAX_CHARS = 2 * 1024 * 1024
const LINK_PREVIEW_ICON_MAX_CHARS = 64 * 1024
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

const httpUrlSchema = z.url().refine((value) => {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
})

const linkPreviewHtmlSchema = z.object({
  html: z.string().max(LINK_PREVIEW_HTML_MAX_CHARS),
  finalUrl: httpUrlSchema,
})

const linkPreviewIconSchema = z
  .string()
  .max(LINK_PREVIEW_ICON_MAX_CHARS)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u)
  .refine((value) => value.slice(PNG_DATA_URL_PREFIX.length).length % 4 === 0)

/** Bounded, public-network-only HTML returned for editor link metadata. */
export type LinkPreviewHtml = z.infer<typeof linkPreviewHtmlSchema>

/**
 * Bounded outbound web fetches the native side performs (scheme, size,
 * timeout and redirect caps), so the webview's own HTTP capability never
 * widens. Every URL must have passed the privacy gate.
 */
export interface WebFetchService {
  /** A captured page's HTML, for meta-tag scraping. */
  fetchMeta(url: CloudSafe<string>): Promise<string>
  /** An oEmbed endpoint's JSON answer as text. Only `https` JSON answers without redirects. */
  fetchOembed(url: CloudSafe<string>): Promise<string>
  /** One representative image for a captured URL as a base64 JPEG, or `null` when unavailable. */
  fetchLinkPreviewImage(url: CloudSafe<string>): Promise<string | null>
  /** An HTTP(S) page for an editor link preview. Non-public destinations are refused. */
  fetchLinkPreviewHtml(url: CloudSafe<string>): Promise<LinkPreviewHtml>
  /** A public raster favicon, normalized into a small PNG data URL. */
  fetchLinkPreviewIcon(url: CloudSafe<string>): Promise<string>
}

export function createWebFetchService(deps: { ipc: IpcBridgeService }): WebFetchService {
  const { ipc } = deps
  return {
    fetchMeta: async (url) => await ipc.call('capture_meta_fetch', { url }, z.string()),
    fetchOembed: async (url) => await ipc.call('capture_oembed_fetch', { url }, z.string()),
    fetchLinkPreviewImage: async (url) =>
      await ipc.call('capture_link_preview', { url }, z.string().nullable()),
    fetchLinkPreviewHtml: async (url) =>
      await ipc.call('link_preview_fetch_html', { url }, linkPreviewHtmlSchema),
    fetchLinkPreviewIcon: async (url) =>
      await ipc.call('link_preview_fetch_icon', { url }, linkPreviewIconSchema),
  }
}

let defaultService: WebFetchService | null = null

/** The process-wide `WebFetchService`; one over the installed bridge unless replaced. */
export function defaultWebFetch(): WebFetchService {
  defaultService ??= createWebFetchService({ ipc: currentIpc() })
  return defaultService
}

/** Install the process-wide `WebFetchService`; `null` restores the one over the installed bridge. */
export function setDefaultWebFetch(service: WebFetchService | null): void {
  defaultService = service
}
