import { useCallback } from 'react'
import { useLinkNavigationHost } from '@/hooks/use-link-navigation-host.ts'
import { useLinkNavigationService } from '@/hooks/use-link-navigation-service.ts'

/**
 * Navigation for a clicked `[[wiki link]]`. Calendar-valid ISO dates preserve
 * ordinary resolution precedence, then open their lazy daily route on a miss.
 * Every other writable title goes through the ambiguity-preserving index +
 * disk resolver before it opens or creates, so an indexed duplicate cannot
 * bypass the same guard used for an index miss. With no graph generation
 * available, existing titles still use the read-only index resolver and
 * unresolved titles are a no-op.
 *
 * An `openInNewWindow` request (a ⌘-click or a spare-`mod` keyboard follow,
 * decided at the editor boundary from meowdown's `mod` flag) opens the
 * resolved target in a secondary note window instead, falling back to
 * in-window navigation whenever the surface can't (browser dev, mobile), so
 * the request never makes a link do nothing.
 *
 * Resolution is async, and the host pane can unmount or the user can act
 * again while it's in flight — a late navigate would yank the user somewhere
 * they've already left, so every navigation is gated on the shared link
 * intent (`useLinkIntentGuard`).
 *
 * @param generation the open graph's write generation (`GraphInfo.generation`),
 *   or `null` when no graph is writable.
 * @returns a stable-per-`generation` click handler for the editor's wiki-link
 *   extension.
 */
export function useWikiLinkNavigation(
  generation: number | null,
): (options: { target: string; openInNewWindow: boolean }) => void {
  const linkNavigation = useLinkNavigationService()
  const host = useLinkNavigationHost()

  return useCallback(
    ({ target, openInNewWindow }: { target: string; openInNewWindow: boolean }) => {
      linkNavigation.followWikiLink({ target, openInNewWindow, generation }, host)
    },
    [generation, host, linkNavigation],
  )
}
