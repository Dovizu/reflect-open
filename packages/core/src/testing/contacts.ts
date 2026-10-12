import type { LoggerService } from '../app/logger-service.ts'
import type {
  ContactMatch,
  ContactsAuthorization,
  ContactsService,
} from '../contacts/contacts-service.ts'
import { createMeetingService, type MeetingService } from '../contacts/meeting-service.ts'
import { createPersonNoteService, type PersonNoteService } from '../contacts/person-note-service.ts'
import type { NoteCreationService } from '../graph/note-creation-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import { createSuggestionService, type SuggestionService } from '../indexing/suggestion-service.ts'
import {
  createWikiResolverService,
  type WikiResolverService,
} from '../indexing/wiki-resolver-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import { createTestDatabaseService } from './database.ts'
import {
  createTestNoteCreationService,
  createTestNoteFileService,
  createTestNoteLinkResolverService,
} from './graph.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestSettingsService } from './settings.ts'

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
 * An in-memory {@link ContactsService} over a fixed address book.
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

  return {
    authorizationStatus: async () => status,
    requestAccess: async () => {
      requests++
      if (status === 'notDetermined') {
        status = grantAccess ? 'authorized' : 'denied'
      }
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
    setStatus(next) {
      status = next
    },
    setContacts(next) {
      contacts = [...next]
    },
    accessRequests: () => requests,
    lookups: () => [...log],
  }
}

export interface TestPersonNoteServiceOptions {
  /** The index that owns the `#person` notes. Defaults to an empty {@link createTestDatabaseService}. */
  database?: DatabaseService
  /** Defaults to the real resolver over `database`. */
  wikiResolver?: Pick<WikiResolverService, 'getWikiAddressForPath'>
  /** Defaults to a fresh {@link createTestNoteCreationService}. */
  noteCreation?: Pick<NoteCreationService, 'resolveOrCreateNoteWithTitle'>
}

/** The real {@link PersonNoteService} over fresh test doubles by default. */
export function createTestPersonNoteService(
  options?: TestPersonNoteServiceOptions,
): PersonNoteService {
  const database = options?.database ?? createTestDatabaseService()
  return createPersonNoteService({
    database,
    wikiResolver: options?.wikiResolver ?? createWikiResolverService({ database }),
    noteCreation: options?.noteCreation ?? createTestNoteCreationService(),
  })
}

export interface TestMeetingServiceOptions {
  /** The index behind the default resolvers. Defaults to an empty {@link createTestDatabaseService}. */
  database?: DatabaseService
  /** Defaults to an empty {@link createTestNoteFileService}. */
  noteFile?: NoteFileService
  /** Defaults to the real resolver over `database`. */
  wikiResolver?: WikiResolverService
  /** Defaults to the real suggestions over `database`. */
  suggestions?: Pick<SuggestionService, 'suggestWikiTargets'>
  /** Defaults to a {@link createTestNoteCreationService} over `noteFile` and `wikiResolver`. */
  noteCreation?: NoteCreationService
  /** Defaults to the real service over `database`, `wikiResolver` and `noteCreation`. */
  personNotes?: PersonNoteService
  /** Defaults to a fresh {@link createTestContactsService}. */
  contacts?: ContactsService
  /** Defaults to a fresh {@link createTestSettingsService}. */
  settings?: SettingsService
  /** Defaults to a fresh {@link createTestLoggerService}. */
  logger?: LoggerService
}

/** The real {@link MeetingService} over fresh test doubles by default. */
export function createTestMeetingService(options?: TestMeetingServiceOptions): MeetingService {
  const database = options?.database ?? createTestDatabaseService()
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  const wikiResolver = options?.wikiResolver ?? createWikiResolverService({ database })
  const noteCreation =
    options?.noteCreation ??
    createTestNoteCreationService({
      noteFile,
      noteLinkResolver: createTestNoteLinkResolverService({ wikiResolver, noteFile }),
    })
  return createMeetingService({
    noteFile,
    noteCreation,
    wikiResolver,
    suggestions: options?.suggestions ?? createSuggestionService({ database }),
    personNotes:
      options?.personNotes ?? createPersonNoteService({ database, wikiResolver, noteCreation }),
    contacts: options?.contacts ?? createTestContactsService(),
    settings: options?.settings ?? createTestSettingsService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}
