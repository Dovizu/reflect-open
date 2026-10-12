import {
  defaultNoteDocuments,
  type NoteDocumentService,
} from '../documents/note-document-service.ts'
import {
  defaultOpenDocuments,
  type OpenDocumentsService,
} from '../documents/open-documents-service.ts'
import { defaultNoteFile, type NoteFileService } from '../graph/note-file-service.ts'
import { isDaily } from '../graph/paths.ts'
import { parseNote } from '../markdown/extract.ts'
import { splitFrontmatter } from '../markdown/frontmatter.ts'
import type { Settings } from '../settings/schema.ts'
import { defaultSettings, type SettingsService } from '../settings/settings-service.ts'
import { isContactsReadable } from './commands.ts'
import {
  defaultContacts,
  type ContactMatch,
  type ContactsAuthorization,
  type ContactsService,
} from './contacts-service.ts'
import { appendContactDetails, contactDetailsMarkdown, noteHasContactDetails } from './markdown.ts'
import { contactNamesEqual, matchContactForTitle } from './match.ts'

/**
 * The suggested-contact card (the contacts-integration port): a note whose
 * title exactly matches an Apple Contact is offered that contact's details.
 * Suppression follows v1's model:
 *
 * - **content**: a body that already carries contact details (an email, an
 *   `Email:`/`Phone:` bullet) gets no card, whether Add wrote them or the
 *   user typed them. This is also what hides the card after Add.
 * - **dismissals**: a contact named in the note's `ignoredContacts`
 *   frontmatter list never re-suggests; other contacts still may.
 *
 * The card's two resolutions: **Add** lands the contact's details in the body
 * as plain markdown, a single write with no frontmatter mark. **Ignore**
 * records the contact's name in `ignoredContacts`, per contact, so a retitled
 * note stays eligible for its own suggestion. Nothing ever syncs back to the
 * address book.
 */
export interface ContactSuggestionService {
  /** The Contacts permission state. Never prompts. */
  authorizationStatus(): Promise<ContactsAuthorization>
  /**
   * The Apple Contact the title of the note at `path` exactly matches, or
   * `null`: no match, a match with nothing to add, a body that already
   * carries contact details, or a contact dismissed on this note. Callers
   * gate on {@link showsContactSuggestions} first.
   */
  suggestionFor(path: string): Promise<ContactMatch | null>
  /**
   * Merge `contact`'s details into the note: the `- Type: #person` typing line
   * plus every email and phone, appended as their own block. Routes through
   * the live session when the note is open — the card sits above an open
   * editor, so unsaved edits must survive — and refuses rather than clobber
   * when the session can't take it (loading, protected, or a parked conflict).
   * A closed note is patched on disk. Retry-safe: a body that already carries
   * the details is left alone. Throws when the title no longer matches
   * `contact`.
   */
  addToNote(path: string, contact: ContactMatch, generation: number): Promise<void>
  /**
   * Dismiss the suggestion for this note: record `contact`'s name in the
   * `ignoredContacts` frontmatter list, write nothing else. A stale card (the
   * title no longer matches `contact`) skips the write silently — the user
   * wanted the card gone, and the new title must stay eligible for its own
   * suggestion.
   */
  ignore(path: string, contact: ContactMatch, generation: number): Promise<void>
  /** Switch the integration on or off. Never prompts. */
  setEnabled(enabled: boolean): void
  /**
   * Trigger the OS contacts permission prompt. Never rejects: a failed prompt
   * (e.g. it timed out unanswered) isn't surfaced, the permission state is the
   * truth.
   */
  requestAccess(): Promise<void>
}

/**
 * The card's gate for the note at `path`: the integration is enabled, the
 * permission is readable, and the note is not a daily one. `authorization` is
 * `null` while its first read is in flight.
 */
export function showsContactSuggestions(
  settings: Pick<Settings, 'contactsEnabled'>,
  authorization: ContactsAuthorization | null,
  path: string,
): boolean {
  return (
    settings.contactsEnabled &&
    authorization !== null &&
    isContactsReadable(authorization) &&
    !isDaily(path)
  )
}

/** The card's detail line: the contact's primary email and phone. */
export function suggestedContactDetails(contact: ContactMatch): string {
  return [contact.emails[0], contact.phones[0]]
    .filter((value): value is string => value !== undefined && value.trim() !== '')
    .join(' · ')
}

/** Does the Contacts framework exist here? `null` is a read still in flight. */
export function isContactsAvailable(authorization: ContactsAuthorization | null): boolean {
  return authorization !== null && authorization !== 'unavailable'
}

/**
 * What the settings switch says about the permission while the integration
 * is on:
 *
 * - `denied`: the app cannot re-prompt once the user has decided, so the
 *   notice points at System Settings.
 * - `prompt`: enabled but never asked. The toggle-on prompt didn't complete
 *   (quit mid-prompt, settings restored from another machine), so the notice
 *   offers the prompt again. Suppressed while a prompt is up.
 */
export function contactsAccessNotice(
  settings: Pick<Settings, 'contactsEnabled'>,
  authorization: ContactsAuthorization | null,
  isPrompting: boolean,
): 'denied' | 'prompt' | null {
  if (!settings.contactsEnabled) {
    return null
  }
  if (authorization === 'denied' || authorization === 'restricted') {
    return 'denied'
  }
  return authorization === 'notDetermined' && !isPrompting ? 'prompt' : null
}

/** Only an undecided permission can still show the OS prompt. */
export function canPromptForContacts(authorization: ContactsAuthorization | null): boolean {
  return authorization === 'notDetermined'
}

export function createContactSuggestionService(deps: {
  contacts: ContactsService
  noteDocuments: Pick<NoteDocumentService, 'readSource' | 'commitFrontmatter'>
  openDocuments: Pick<OpenDocumentsService, 'sessionFor'>
  noteFile: Pick<NoteFileService, 'write'>
  settings: SettingsService
}): ContactSuggestionService {
  const { contacts, noteDocuments, openDocuments, noteFile, settings } = deps

  /**
   * Action-time revalidation: the card's suggestion is a cached answer, but the
   * title may have been edited (even unsaved) since it resolved. Returns the
   * live source when the note still carries the contact's name, else null —
   * a stale card must neither merge the wrong details nor dismiss the new
   * title's own suggestion.
   */
  async function sourceIfStillMatching(
    path: string,
    contact: ContactMatch,
  ): Promise<string | null> {
    const source = await noteDocuments.readSource(path)
    const title = parseNote({ path, source }).title
    return matchContactForTitle(title, [contact]) === null ? null : source
  }

  /**
   * Look up `title` in Apple Contacts and apply the exact-match rule. Answers
   * null for blank titles without a lookup.
   */
  async function contactForTitle(title: string): Promise<ContactMatch | null> {
    if (title.trim() === '') {
      return null
    }
    const candidates = await contacts.lookupByName(title.trim())
    return matchContactForTitle(title, candidates)
  }

  return {
    authorizationStatus: () => contacts.authorizationStatus(),

    async suggestionFor(path) {
      const source = await noteDocuments.readSource(path)
      if (noteHasContactDetails(splitFrontmatter(source).body)) {
        return null
      }
      const note = parseNote({ path, source })
      const match = await contactForTitle(note.title)
      // A match with nothing to add (no email, no phone) has no card to offer.
      if (match === null || contactDetailsMarkdown(match) === '') {
        return null
      }
      const dismissed = note.frontmatter.ignoredContacts.some((name) =>
        contactNamesEqual(name, match.fullName),
      )
      return dismissed ? null : match
    },

    async addToNote(path, contact, generation) {
      const source = await sourceIfStillMatching(path, contact)
      if (source === null) {
        throw new Error('The note title no longer matches this contact.')
      }
      const body = splitFrontmatter(source).body
      // The same content gate the card renders through: a body that already
      // carries contact details — a previous Add's block, or an email the user
      // typed under a still-cached card — must not get a (second) block. The
      // body-aware block also drops the `- Type: #person` line when the note was
      // already typed at creation (meeting flow, link menu).
      const details = contactDetailsMarkdown(contact, body)
      if (details === '' || noteHasContactDetails(body)) {
        return
      }
      const owner = openDocuments.sessionFor(path)
      if (owner !== null) {
        if (!(await owner.commitBodyAppend(details))) {
          throw new Error('This note can’t be updated right now — try again in a moment.')
        }
        return
      }
      // Reuse the validated snapshot — with no session, `source` came from disk.
      // A second read here would reopen the window between the check and the write.
      await noteFile.write(path, appendContactDetails(source, contact), generation)
    },

    async ignore(path, contact, generation) {
      const source = await sourceIfStillMatching(path, contact)
      if (source === null) {
        return
      }
      const ignored = parseNote({ path, source }).frontmatter.ignoredContacts
      if (ignored.some((name) => contactNamesEqual(name, contact.fullName))) {
        return
      }
      await noteDocuments.commitFrontmatter(
        path,
        { ignoredContacts: [...ignored, contact.fullName] },
        generation,
      )
    },

    setEnabled(enabled) {
      settings.update({ contactsEnabled: enabled })
    },

    async requestAccess() {
      await contacts.requestAccess().catch(() => {})
    },
  }
}

type ContactSuggestionServiceDeps = {
  contacts: ContactsService
  noteDocuments: NoteDocumentService
  openDocuments: OpenDocumentsService
  noteFile: NoteFileService
  settings: SettingsService
}

let installedService: ContactSuggestionService | null = null
let fallback: { service: ContactSuggestionService; deps: ContactSuggestionServiceDeps } | null =
  null

/**
 * The process-wide `ContactSuggestionService`; one over the default services
 * unless {@link setDefaultContactSuggestions} installed another.
 */
export function defaultContactSuggestions(): ContactSuggestionService {
  if (installedService !== null) {
    return installedService
  }
  const deps: ContactSuggestionServiceDeps = {
    contacts: defaultContacts(),
    noteDocuments: defaultNoteDocuments(),
    openDocuments: defaultOpenDocuments(),
    noteFile: defaultNoteFile(),
    settings: defaultSettings(),
  }
  if (
    fallback?.deps.contacts !== deps.contacts ||
    fallback.deps.noteDocuments !== deps.noteDocuments ||
    fallback.deps.openDocuments !== deps.openDocuments ||
    fallback.deps.noteFile !== deps.noteFile ||
    fallback.deps.settings !== deps.settings
  ) {
    fallback = { service: createContactSuggestionService(deps), deps }
  }
  return fallback.service
}

/**
 * Install the process-wide `ContactSuggestionService`; `null` restores the
 * one over the default services.
 */
export function setDefaultContactSuggestions(service: ContactSuggestionService | null): void {
  installedService = service
}
