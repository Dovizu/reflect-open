import { z } from 'zod'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'

/**
 * The Rust `contacts` capability: live Apple Contacts (`CNContactStore`)
 * reads. Lookups are on-demand queries: the address book is never mirrored
 * into the index, and nothing here writes back to Contacts. Matching policy
 * lives in the sibling modules, not in Rust.
 */

/**
 * The Contacts permission state. `unavailable` is the answer on platforms
 * without the Contacts framework (Windows, Linux, Android) so the settings UI
 * can hide the integration instead of branching on error kinds.
 */
export const contactsAuthorizationSchema = z.enum([
  'notDetermined',
  'restricted',
  'denied',
  'authorized',
  'limited',
  'unavailable',
])

export type ContactsAuthorization = z.infer<typeof contactsAuthorizationSchema>

/**
 * One matched contact, flattened to the fields Reflect can write into a note.
 * Field-level `.catch` keeps a single odd contact from failing a whole lookup.
 */
export const contactMatchSchema = z.object({
  /** Locale-aware display name (given/family ordering differs by locale). */
  fullName: z.string().catch(''),
  givenName: z.string().catch(''),
  familyName: z.string().catch(''),
  emails: z.array(z.string()).catch([]),
  phones: z.array(z.string()).catch([]),
})

export type ContactMatch = z.infer<typeof contactMatchSchema>

/** Live reads of the OS address book. */
export interface ContactsService {
  /** The current Contacts permission state. Never prompts. */
  authorizationStatus(): Promise<ContactsAuthorization>
  /**
   * Trigger the OS contacts permission prompt (a no-op once the user has
   * decided) and report whether access is granted.
   */
  requestAccess(): Promise<boolean>
  /** Unified contacts with an email address matching `email`. */
  lookupByEmail(email: string): Promise<ContactMatch[]>
  /**
   * Unified contacts matching `name` through the framework's own name
   * matching (case- and diacritic-insensitive, word-prefix based).
   */
  lookupByName(name: string): Promise<ContactMatch[]>
}

export function createContactsService(deps: { ipc: IpcBridgeService }): ContactsService {
  const { ipc } = deps
  return {
    authorizationStatus: () =>
      ipc.call('contacts_authorization_status', {}, contactsAuthorizationSchema),
    requestAccess: () => ipc.call('contacts_request_access', {}, z.boolean()),
    lookupByEmail: (email) =>
      ipc.call('contacts_lookup_by_email', { email }, z.array(contactMatchSchema)),
    lookupByName: (name) =>
      ipc.call('contacts_lookup_by_name', { name }, z.array(contactMatchSchema)),
  }
}

let defaultService: ContactsService | null = null

/** The process-wide `ContactsService`; one over the installed bridge unless replaced. */
export function defaultContacts(): ContactsService {
  defaultService ??= createContactsService({ ipc: currentIpc() })
  return defaultService
}

/** Install the process-wide `ContactsService`; `null` restores the bridge-backed one. */
export function setDefaultContacts(service: ContactsService | null): void {
  defaultService = service
}
