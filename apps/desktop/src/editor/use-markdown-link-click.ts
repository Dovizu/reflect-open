import { useCallback } from 'react'
import type { LinkClickHandler } from '@meowdown/core'
import { isOpenableExternalUrl } from '@/editor/open-external-link.ts'
import { useMarkdownLinkNavigation } from '@/editor/use-markdown-link-navigation.ts'
import { useAttachments } from '@/editor/use-note-attachments.ts'
import { isDeepLinkUrl } from '@/lib/deep-links/parse.ts'
import { useFollowDeepLink } from '@/lib/deep-links/use-follow-deep-link.ts'
import { openUrlSync } from '@/lib/open-url.ts'

/**
 * The click policy for a rendered Markdown link: an attachment opens through
 * the asset command, a `reflect://` link through the deep-link pipeline, any
 * other allowed scheme through the OS opener, and a scheme-less href is a
 * note link resolved from `sourcePath`. A `null` `sourcePath` means the
 * Markdown belongs to no note, so attachment and note links do nothing.
 */
export function useMarkdownLinkClick(
  generation: number | null,
  sourcePath: string | null,
): LinkClickHandler {
  const followDeepLink = useFollowDeepLink()
  const navigateNoteLink = useMarkdownLinkNavigation(generation, sourcePath ?? '')
  const attachments = useAttachments()

  return useCallback<LinkClickHandler>(
    ({ href, event, mod }) => {
      event.preventDefault()
      if (generation !== null && sourcePath !== null) {
        const assetPath = attachments.resolveAssetOpenPath(sourcePath, href, generation)
        if (assetPath !== null) {
          void attachments.openOrReveal(assetPath, generation)
          return
        }
      }
      if (isDeepLinkUrl(href)) {
        followDeepLink({ href, openInNewWindow: mod })
        return
      }
      if (isOpenableExternalUrl(href)) {
        openUrlSync(href)
        return
      }
      if (sourcePath !== null) {
        navigateNoteLink({ href, openInNewWindow: mod })
      }
    },
    [attachments, followDeepLink, generation, navigateNoteLink, sourcePath],
  )
}
