import { useQuery } from '@tanstack/react-query'
import { showsContactSuggestions, type ContactMatch } from '@reflect/core'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'
import { queryKeys } from '@/lib/query-client.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useSettings } from '@/providers/settings-provider.tsx'
import { useContactSuggestionService } from '@/services/use-contacts-services.ts'
import { useContactsAuthorization } from './use-contacts-authorization.ts'

/**
 * The Apple Contact this note's title exactly matches, or `null` — the
 * suggested-contact card renders on a non-null answer. Gated hard: the
 * integration must be enabled, the permission readable, and the note a
 * non-daily one. Suppression follows v1's model:
 *
 * - **content** — a body that already carries contact details (an email, an
 *   `Email:`/`Phone:` bullet) gets no card, whether Add wrote them or the
 *   user typed them. This is also what hides the card after Add.
 * - **dismissals** — a contact named in the note's `ignoredContacts`
 *   frontmatter list never re-suggests; other contacts still may.
 *
 * Keyed under the `index` scope on purpose: resolving the card writes the
 * note, the watcher re-indexes it, and the usual index invalidation refetches
 * this — the card hides through the same file-is-truth loop as everything else.
 */
export function useSuggestedContact(path: string): ContactMatch | null {
  const { graph } = useGraph()
  const { settings } = useSettings()
  const authorization = useContactsAuthorization()
  const contactSuggestions = useContactSuggestionService()
  const bridgeReady = useBridgeReady()
  const enabled =
    bridgeReady && graph !== null && showsContactSuggestions(settings, authorization, path)
  const { data } = useQuery({
    queryKey: queryKeys.index.suggestedContact(graph?.root, path),
    queryFn: () => contactSuggestions.suggestionFor(path),
    enabled,
  })
  // A disabled query still serves its last cached answer — but once the gate
  // is off (integration disabled, permission revoked), the card must drop
  // immediately, not on the next cache sweep.
  return enabled ? (data ?? null) : null
}
