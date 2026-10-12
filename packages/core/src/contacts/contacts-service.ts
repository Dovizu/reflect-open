import { z } from 'zod'
import type { LoggerService } from '../app/logger-service.ts'
import type { IpcBridgeService, Unlisten } from '../ipc/ipc-service.ts'
import type { Settings } from '../settings/schema.ts'
import {
  contactMatchSchema,
  contactsAuthorizationSchema,
  isContactsReadable,
  type ContactMatch,
  type ContactsAuthorization,
} from './commands.ts'
import { pickContactLinkSuggestions } from './match.ts'

export {
  contactMatchSchema,
  contactsAuthorizationSchema,
  type ContactMatch,
  type ContactsAuthorization,
} from './commands.ts'

/**
 * The Rust `contacts` capability: live Apple Contacts (`CNContactStore`)
 * reads. Lookups are on-demand queries: the address book is never mirrored
 * into the index, and nothing here writes back to Contacts. Matching policy
 * lives in the sibling modules, not in Rust.
 */

/** How many contacts {@link ContactsService.lookupPeople} answers at most. */
const CONTACT_SUGGESTION_LIMIT = 4

/** What the app last read of the Contacts permission. */
export interface ContactsState {
  /** The permission state, or `null` until the first {@link ContactsService.refresh} lands. */
  readonly authorization: ContactsAuthorization | null
}

/** Live reads of the OS address book, and the permission state as a store. */
export interface ContactsService {
  /** The current {@link ContactsState}; the same object until it changes. */
  getState: () => ContactsState
  /** Listen for state changes; returns the unsubscribe. */
  subscribe: (listener: () => void) => Unlisten
  /**
   * Re-read the permission state. Never prompts and never rejects: a failed
   * read keeps the last state.
   */
  refresh(): Promise<void>
  /**
   * Trigger the OS contacts permission prompt (a no-op once the user has
   * decided), refresh the state, and report whether access is granted.
   */
  requestAccess(): Promise<boolean>
  /** The contacts gate: the integration is enabled and the permission is readable. */
  canLookup(settings: Pick<Settings, 'contactsEnabled'>): boolean
  /**
   * The contacts a person-picker offers for `query`: the framework's
   * word-prefix name matches, ranked and capped. Queries shorter than two
   * characters answer empty, since one letter matches half the address book.
   */
  lookupPeople(query: string): Promise<ContactMatch[]>
  /** Unified contacts with an email address matching `email`. */
  lookupByEmail(email: string): Promise<ContactMatch[]>
  /**
   * Unified contacts matching `name` through the framework's own name
   * matching (case- and diacritic-insensitive, word-prefix based).
   */
  lookupByName(name: string): Promise<ContactMatch[]>
}

/** The {@link ContactsService} methods that hold state or reach the OS. */
export type ContactsSource = Omit<ContactsService, 'canLookup' | 'lookupPeople'>

/** Complete `source` with the gate and the lookup derived from it. */
export function withContactsLookups(source: ContactsSource): ContactsService {
  return {
    ...source,
    canLookup(settings) {
      const { authorization } = source.getState()
      return settings.contactsEnabled && authorization !== null && isContactsReadable(authorization)
    },
    async lookupPeople(query) {
      const trimmed = query.trim()
      if (trimmed.length < 2) {
        return []
      }
      return pickContactLinkSuggestions(
        await source.lookupByName(trimmed),
        CONTACT_SUGGESTION_LIMIT,
      )
    },
  }
}

export function createContactsService(deps: {
  ipc: IpcBridgeService
  logger: Pick<LoggerService, 'warn'>
}): ContactsService {
  const { ipc, logger } = deps
  const listeners = new Set<() => void>()
  let state: ContactsState = { authorization: null }

  async function refresh(): Promise<void> {
    let authorization: ContactsAuthorization
    try {
      authorization = await ipc.call(
        'contacts_authorization_status',
        {},
        contactsAuthorizationSchema,
      )
    } catch (cause) {
      logger.warn('failed to read the contacts permission', cause)
      return
    }
    if (authorization === state.authorization) {
      return
    }
    state = { authorization }
    for (const listener of listeners) {
      listener()
    }
  }

  return withContactsLookups({
    getState: () => state,
    subscribe: (listener) => {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    refresh,
    async requestAccess() {
      try {
        return await ipc.call('contacts_request_access', {}, z.boolean())
      } finally {
        await refresh()
      }
    },
    lookupByEmail: (email) =>
      ipc.call('contacts_lookup_by_email', { email }, z.array(contactMatchSchema)),
    lookupByName: (name) =>
      ipc.call('contacts_lookup_by_name', { name }, z.array(contactMatchSchema)),
  })
}
