import { useCallback } from 'react'
import { useLinkNavigationService } from '@/hooks/use-link-navigation-service.ts'
import { useLinkIntentGuard } from '@/lib/windows/use-link-intent-guard.ts'

/** Follow one in-app `reflect://` link. */
export type FollowDeepLink = (options: { href: string; openInNewWindow: boolean }) => void

/**
 * Follow an in-app deep link, applying the note-link modifier convention to
 * address-like links while leaving capture links as writes in this window.
 * A failed window open falls back only while the shared link intent
 * ({@link useLinkIntentGuard}) is still current.
 */
export function useFollowDeepLink(): FollowDeepLink {
  const linkNavigation = useLinkNavigationService()
  const beginIntent = useLinkIntentGuard()

  return useCallback(
    (options) => {
      linkNavigation.followDeepLink(options, { beginIntent })
    },
    [beginIntent, linkNavigation],
  )
}
