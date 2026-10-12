import {
  defaultContacts,
  type ContactMatch,
  type ContactsAuthorization,
} from './contacts-service.ts'

/**
 * Bindings for the Rust `contacts` capability over the default
 * `ContactsService`, plus the permission policy.
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

/** The current Contacts permission state. Never prompts. */
export async function contactsAuthorizationStatus(): Promise<ContactsAuthorization> {
  return await defaultContacts().authorizationStatus()
}

/** See `ContactsService.requestAccess`. */
export async function requestContactsAccess(): Promise<boolean> {
  return await defaultContacts().requestAccess()
}

/** Unified contacts with an email address matching `email`. */
export async function lookupContactsByEmail(email: string): Promise<ContactMatch[]> {
  return await defaultContacts().lookupByEmail(email)
}

/**
 * Unified contacts matching `name` through the framework's own name matching.
 * Callers apply the exact-match policy through `matchContactForTitle`.
 */
export async function lookupContactsByName(name: string): Promise<ContactMatch[]> {
  return await defaultContacts().lookupByName(name)
}
