import {
  withContactsLookups,
  type ContactMatch,
  type ContactsAuthorization,
  type ContactsService,
  type ContactsState,
} from '../contacts/contacts-service.ts'

export interface TestContactsServiceOptions {
  /** The permission state. Defaults to `authorized`. */
  status?: ContactsAuthorization
  /** Whether the permission prompt grants access. Defaults to `true`. */
  grantAccess?: boolean
  contacts?: readonly ContactMatch[]
}

export type ContactsLookup =
  | { readonly kind: 'email'; readonly email: string }
  | { readonly kind: 'name'; readonly name: string }

export interface TestContactsService extends ContactsService {
  /** Set the permission state, as the OS and as already read by the app. */
  setStatus(status: ContactsAuthorization): void
  setContacts(contacts: readonly ContactMatch[]): void
  /** How many times `requestAccess` ran. */
  accessRequests(): number
  lookups(): readonly ContactsLookup[]
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
}

/**
 * An in-memory {@link ContactsService} over a fixed address book. Its state
 * starts read: `getState` answers `status` at once.
 * `lookupByEmail` matches an address case-insensitively; `lookupByName`
 * matches when every query word is a prefix of a word in a contact's names.
 * Like the OS, `requestAccess` prompts only while the status is
 * `notDetermined`.
 */
export function createTestContactsService(
  options?: TestContactsServiceOptions,
): TestContactsService {
  let status = options?.status ?? 'authorized'
  let contacts = [...(options?.contacts ?? [])]
  const grantAccess = options?.grantAccess ?? true
  let requests = 0
  const log: ContactsLookup[] = []
  const listeners = new Set<() => void>()
  let state: ContactsState = { authorization: status }

  function adoptStatus(): void {
    if (state.authorization === status) {
      return
    }
    state = { authorization: status }
    for (const listener of listeners) {
      listener()
    }
  }

  const service = withContactsLookups({
    getState: () => state,
    subscribe: (listener) => {
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    refresh: async () => {
      adoptStatus()
    },
    requestAccess: async () => {
      requests++
      if (status === 'notDetermined') {
        status = grantAccess ? 'authorized' : 'denied'
      }
      adoptStatus()
      return status === 'authorized' || status === 'limited'
    },
    lookupByEmail: async (email) => {
      log.push({ kind: 'email', email })
      const wanted = email.toLowerCase()
      return contacts.filter((contact) =>
        contact.emails.some((address) => address.toLowerCase() === wanted),
      )
    },
    lookupByName: async (name) => {
      log.push({ kind: 'name', name })
      const query = words(name)
      return contacts.filter((contact) => {
        const names = words(`${contact.fullName} ${contact.givenName} ${contact.familyName}`)
        return (
          query.length > 0 && query.every((part) => names.some((word) => word.startsWith(part)))
        )
      })
    },
  })
  return {
    ...service,
    setStatus(next) {
      status = next
      adoptStatus()
    },
    setContacts(next) {
      contacts = [...next]
    },
    accessRequests: () => requests,
    lookups: () => [...log],
  }
}
