import type { YouTubeVideoResolver } from '@meowdown/core'
import { defaultEmbedMedia } from '@reflect/core'

/** `defaultEmbedMedia().resolveYouTubeVideo`. */
export const resolveYouTubeVideo: YouTubeVideoResolver = (url) => {
  return defaultEmbedMedia().resolveYouTubeVideo(url)
}
