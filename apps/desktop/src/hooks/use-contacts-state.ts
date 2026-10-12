import { useSyncExternalStore } from 'react'
import type { ContactsState } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/** The Contacts permission state as `ContactsService` last read it; re-renders on change. */
export function useContactsState(): ContactsState {
  const { contacts } = useAppServices()
  return useSyncExternalStore(contacts.subscribe, contacts.getState)
}
