import type { ContactsState } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'
import { useServiceState } from '@/services/use-service-state.ts'

/** The Contacts permission state as `ContactsService` last read it; re-renders on change. */
export function useContactsState(): ContactsState {
  const { contacts } = useAppServices()
  return useServiceState(contacts)
}
