import { mapXPostMediaUrls, parseYouTubeVideo } from '@post-embed/schema'
import type { XPost, YouTubeVideo } from '@post-embed/types'
import { oembedRequestURL } from './oembed.ts'
import type { ClockService, TimerHandle } from '../app/clock-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { PlatformService } from '../app/platform-service.ts'
import type { WebFetchService } from '../app/web-fetch-service.ts'
import type { CloudSafe } from '../privacy/cloud-safe.ts'
import { createArchivedPost, type XArchiveService } from '../x-archive.ts'

// A video no note asked for again is dropped this long after it was fetched.
const YOUTUBE_VIDEO_DROP_MS = 30 * 60 * 1000

/** The embedded media of the editor's cards: X posts and YouTube videos. */
export interface EmbedMediaService {
  /**
   * The archived X post `postId` of the graph `generation`, with each media
   * URL that has a local copy mapped to its `reflect-asset:` URL, or `null`
   * when there is none. A post with no archive is fetched from X, archived
   * and read again. X is asked once per post for the service's lifetime; a
   * failed request runs again. Every call reads the archive: the caller
   * caches the answer.
   */
  loadXPost(generation: number, postId: string): Promise<XPost | null>
  /**
   * The card snapshot of a YouTube video URL: at once when it was fetched
   * before, otherwise once the oEmbed endpoint answers. A URL that is not a
   * YouTube video and a failed fetch (which is logged) resolve `undefined`
   * and are asked again.
   */
  resolveYouTubeVideo(url: string): YouTubeVideo | Promise<YouTubeVideo | undefined>
}

export function createEmbedMediaService(deps: {
  xArchive: Pick<XArchiveService, 'resolve' | 'write' | 'fetchSyndication'>
  webFetch: Pick<WebFetchService, 'fetchOembed'>
  platform: Pick<PlatformService, 'convertFileSrc'>
  clock: Pick<ClockService, 'now' | 'setTimeout' | 'clearTimeout'>
  logger: Pick<LoggerService, 'error'>
}): EmbedMediaService {
  const { xArchive, webFetch, platform, clock, logger } = deps
  // What X answered for each post id; a failed request leaves no entry.
  const syndication = new Map<string, Promise<XPost | null>>()
  const videos = new Map<string, YouTubeVideo>()
  const videoFetches = new Map<string, Promise<YouTubeVideo | null>>()
  const videoDrops = new Map<string, TimerHandle>()

  function fetchSyndicationOnce(postId: string): Promise<XPost | null> {
    let pending = syndication.get(postId)
    if (pending === undefined) {
      const request = xArchive.fetchSyndication(postId)
      pending = request
      syndication.set(postId, request)
      request.catch(() => {
        if (syndication.get(postId) === request) {
          syndication.delete(postId)
        }
      })
    }
    return pending
  }

  async function fetchAndArchiveXPost(generation: number, postId: string) {
    const post = await fetchSyndicationOnce(postId)
    if (!post) return null
    await xArchive.write(generation, createArchivedPost(post, new Date(clock.now()).toISOString()))
    return await xArchive.resolve(generation, postId)
  }

  /** The card snapshot for a YouTube video URL, or `null` when the URL is not one. */
  async function fetchYouTubeVideo(url: string): Promise<YouTubeVideo | null> {
    const requestURL = oembedRequestURL(url)
    if (requestURL === null) return null
    // The URL is one the user put on a card, which loads from YouTube anyway.
    const answer: unknown = JSON.parse(await webFetch.fetchOembed(requestURL as CloudSafe<string>))
    const result = parseYouTubeVideo(answer)
    if (result.issues) {
      throw new Error(`invalid oEmbed answer for ${url}: ${JSON.stringify(result.issues)}`)
    }
    return { ...result.value, url }
  }

  function scheduleVideoDrop(url: string): void {
    const scheduled = videoDrops.get(url)
    if (scheduled !== undefined) {
      clock.clearTimeout(scheduled)
    }
    videoDrops.set(
      url,
      clock.setTimeout(() => {
        videoDrops.delete(url)
        videos.delete(url)
      }, YOUTUBE_VIDEO_DROP_MS),
    )
  }

  function fetchYouTubeVideoOnce(url: string): Promise<YouTubeVideo | null> {
    let pending = videoFetches.get(url)
    if (pending === undefined) {
      pending = (async () => {
        try {
          const video = await fetchYouTubeVideo(url)
          // A found video stays for the session; a missing one is asked again.
          if (video !== null) {
            videos.set(url, video)
            scheduleVideoDrop(url)
          }
          return video
        } finally {
          videoFetches.delete(url)
        }
      })()
      videoFetches.set(url, pending)
    }
    return pending
  }

  async function loadYouTubeVideo(url: string): Promise<YouTubeVideo | undefined> {
    try {
      return (await fetchYouTubeVideoOnce(url)) ?? undefined
    } catch (cause) {
      logger.error(`YouTube video fetch failed: ${url}`, cause)
      return
    }
  }

  return {
    async loadXPost(generation, postId) {
      const result =
        (await xArchive.resolve(generation, postId)) ??
        (await fetchAndArchiveXPost(generation, postId))
      if (!result) return null
      const local = new Map(
        result.resources.map((resource) => [
          resource.url,
          platform.convertFileSrc(
            generation + '/x-media/' + postId + '/' + resource.hash,
            'reflect-asset',
          ),
        ]),
      )
      return mapXPostMediaUrls(result.archive.data, (source) => local.get(source))
    },
    resolveYouTubeVideo: (url) => videos.get(url) ?? loadYouTubeVideo(url),
  }
}
