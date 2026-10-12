import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ContactsAuthorization } from '@reflect/core'
import { queryKeys } from '@/lib/query-client.ts'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * One shared query for the Contacts permission state, consumed by the
 * settings section, the settings navigator (which hides the Apple
 * integrations entry on platforms without the framework), and the
 * suggested-contact gate. Not index data — the key lives outside the
 * `index` scope, and consumers refresh it explicitly after prompting.
 */
/** The Contacts permission state, or `null` while the first read is in flight. */
export function useContactsAuthorization(): ContactsAuthorization | null {
  const { contactSuggestions } = useAppServices()
  const { data } = useQuery({
    queryKey: queryKeys.contacts.authorization,
    queryFn: () => contactSuggestions.authorizationStatus(),
  })
  return data ?? null
}

/** Re-read the permission state (after a prompt, or a System Settings trip). */
export function useRefreshContactsAuthorization(): () => Promise<void> {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts.authorization }),
    [queryClient],
  )
}
