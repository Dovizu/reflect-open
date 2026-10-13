import { useCallback } from 'react'
import { useLinkNavigationHost } from '@/hooks/use-link-navigation-host.ts'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Navigation for a clicked Markdown note link (`[Plan](./Plan.md)`), the
 * counterpart of {@link useWikiLinkNavigation} for CommonMark hrefs. The href
 * resolves source-relative from `sourcePath` (vault-root for a leading `/`),
 * with the same branch shape as wiki links except that `missing` is a no-op:
 * an unqualified href has two candidate physical locations, so creation would
 * have to guess where the file belongs.
 */
export function useMarkdownLinkNavigation(
  sourcePath: string,
): (options: { href: string; openInNewWindow: boolean }) => void {
  const { linkNavigation } = useAppServices()
  const host = useLinkNavigationHost()

  return useCallback(
    ({ href, openInNewWindow }: { href: string; openInNewWindow: boolean }) => {
      linkNavigation.followMarkdownNoteLink({ href, sourcePath, openInNewWindow }, host)
    },
    [host, linkNavigation, sourcePath],
  )
}
