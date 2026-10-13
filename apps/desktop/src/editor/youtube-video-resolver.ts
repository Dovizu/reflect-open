import { useCallback } from 'react'
import type { YouTubeVideoResolver } from '@meowdown/core'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * `EmbedMediaService.resolveYouTubeVideo` as the resolver a Markdown view takes.
 */
export function useYouTubeVideoResolver(): YouTubeVideoResolver {
  const { embedMedia } = useAppServices()
  return useCallback((url) => embedMedia.resolveYouTubeVideo(url), [embedMedia])
}
