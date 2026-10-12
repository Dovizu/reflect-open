import type { WebFetchService } from '../app/web-fetch-service.ts'
import { oembedRequestURL, parseOEmbedAnswer } from '../embeds/oembed.ts'
import { toAppError } from '../errors.ts'
import { normalizePageMetaValue, parsePageMeta, type PageMeta } from '../link-preview/metadata.ts'
import type { CloudSafe } from '../privacy/cloud-safe.ts'

/**
 * Meta-tag scraping for link capture (Plan 11) — the no-AI half of
 * enrichment: fetch the captured page (through the hard-capped Rust
 * `capture_meta_fetch` primitive) and pull `<title>`, the meta description,
 * and the OpenGraph basics out of the HTML. Parsing uses `DOMParser`
 * (native in the webview; tests run in a real browser), never regex over HTML.
 */
export interface PageMetaService {
  /**
   * Fetch and parse one captured page's meta tags. URLs a registered oEmbed
   * provider claims (see `embeds/oembed`) resolve through that provider's
   * endpoint first; every other page, and any claimed URL whose oEmbed attempt
   * failed permanently, takes the generic HTML scrape. Propagates the fetch's
   * typed errors (`network` for transient failures the enrichment pass should
   * retry, `io`/`parse` for permanent ones it should write through without).
   */
  scrape(url: CloudSafe<string>): Promise<PageMeta>
}

export function createPageMetaService(deps: {
  webFetch: Pick<WebFetchService, 'fetchMeta' | 'fetchOembed'>
}): PageMetaService {
  const { webFetch } = deps

  async function scrapeOEmbed(requestURL: CloudSafe<string>): Promise<PageMeta | null> {
    let json: string
    try {
      json = await webFetch.fetchOembed(requestURL)
    } catch (cause) {
      const kind = toAppError(cause).kind
      if (kind === 'network' || kind === 'auth') {
        throw cause
      }
      // A refused id (400), a private or embed-disabled video (401/403), and a
      // non-JSON answer are permanent for the shortcut; the generic HTML
      // scrape still gets its turn.
      return null
    }
    const answer = parseOEmbedAnswer(json)
    if (answer === null) {
      return null
    }
    const title = normalizePageMetaValue(answer.title)
    if (title === null) {
      return null
    }
    // oEmbed has no description field; the capture keeps none until (and
    // unless) the AI leg writes one, now grounded in this real title.
    return { title, description: null, siteName: normalizePageMetaValue(answer.providerName) }
  }

  return {
    async scrape(url) {
      const requestURL = oembedRequestURL(url)
      if (requestURL !== null) {
        // The request URL only wraps the gated page URL in the provider's endpoint.
        const meta = await scrapeOEmbed(requestURL as CloudSafe<string>)
        if (meta !== null) {
          return meta
        }
      }
      return parsePageMeta(await webFetch.fetchMeta(url))
    },
  }
}
