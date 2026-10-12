import {
  defaultContacts,
  type ContactMatch,
  type ContactsAuthorization,
} from './contacts-service.ts'

/**
 * The `contacts` capability's shapes, the permission policy, and the name
 * lookup over the default `ContactsService`.
 */

export {
  contactMatchSchema,
  contactsAuthorizationSchema,
  type ContactMatch,
  type ContactsAuthorization,
} from './contacts-service.ts'

/** Can lookups be issued right now? `limited` (iOS 18+) still reads the shared subset. */
export function isContactsReadable(status: ContactsAuthorization): boolean {
  return status === 'authorized' || status === 'limited'
}

/**
 * Unified contacts matching `name` through the framework's own name matching.
 * Callers apply the exact-match policy through `matchContactForTitle`.
 */
export async function lookupContactsByName(name: string): Promise<ContactMatch[]> {
  return await defaultContacts().lookupByName(name)
}
