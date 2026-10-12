import { Counter, isNotNullish } from '@ocavue/utils'
import type { ClockService } from '../app/clock-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import { isContactsReadable } from '../contacts/commands.ts'
import type {
  ContactMatch,
  ContactsAuthorization,
  ContactsService,
} from '../contacts/contacts-service.ts'
import { contactDetailsMarkdown } from '../contacts/markdown.ts'
import { pickContactLinkSuggestions } from '../contacts/match.ts'
import type { PersonContactResolution, PersonNoteService } from '../contacts/person-note-service.ts'
import { errorMessage } from '../errors.ts'
import type { NoteCreationService } from '../graph/note-creation-service.ts'
import { ambiguousNoteTitleMessage } from '../graph/note-reference.ts'
import { aliasHint } from '../indexing/suggest.ts'
import type { SuggestionService } from '../indexing/suggestion-service.ts'
import { formatDayLabel } from '../lib/date-labels.ts'
import { localIsoDate } from '../lib/dates.ts'
import { displayNoteTitle } from '../markdown/note-title.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import { buildAutocompleteEntries } from './wiki-autocomplete-entries.ts'

/** One row of the editor's `[[` menu. The rows arrive ranked; the menu does not re-sort. */
export interface WikiLinkMenuItem {
  /** Inserted as `[[target]]`. */
  target: string
  label: string
  /** Secondary text shown beside the label. */
  detail?: string
  /** Runs after the menu inserted the link, e.g. to create the note in the background. */
  onSelect?: () => void
}

/** One row of the editor's `#` menu. */
export interface TagMenuItem {
  /** Inserted as `#tag `. */
  tag: string
}

/** How many Contact rows the `[[` menu shows at most. */
const CONTACT_SUGGESTION_LIMIT = 4

export interface WikiLinkSuggestionOptions {
  /** The open graph's generation: a background create that outlives it is rejected. */
  generation: number
  /**
   * The Contacts permission state, or `null` while it is unknown. Contacts
   * join the menu (v1's backlink-menu behavior) only while the integration is
   * on and the permission readable.
   */
  contactsAuthorization: ContactsAuthorization | null
}

/**
 * The editor's `[[` and `#` autocomplete, shared by every note editor (the
 * note pane and the Tasks view's inline editor). The menu UI hands over the
 * raw text typed after `[[` (case preserved, spaces and slashes intact — only
 * `[`, `]`, and newlines close the menu); ranking stays the index's job, so
 * neither menu re-sorts the rows.
 */
export interface WikiLinkSuggestionService {
  /**
   * The `[[` menu rows for `query`: ranked note suggestions, Contact rows, and
   * a trailing `Create "<query>"` row when nothing matches the typed text.
   */
  suggestLinks(query: string, options: WikiLinkSuggestionOptions): Promise<WikiLinkMenuItem[]>
  /** The `#` menu rows for `query`, most-used first. */
  suggestTags(query: string): Promise<TagMenuItem[]>
}

export interface WikiLinkSuggestionServiceDeps {
  suggestions: Pick<SuggestionService, 'suggestWikiLinkTargets' | 'suggestTags'>
  noteCreation: Pick<NoteCreationService, 'resolveOrCreateNoteWithTitle'>
  contacts: Pick<ContactsService, 'lookupByName'>
  personNotes: Pick<PersonNoteService, 'resolvePersonContact' | 'ensurePersonNote'>
  settings: Pick<SettingsService, 'get'>
  clock: Pick<ClockService, 'now'>
  operations: Pick<OperationsService, 'start'>
  logger: LoggerService
}

export function createWikiLinkSuggestionService(
  deps: WikiLinkSuggestionServiceDeps,
): WikiLinkSuggestionService {
  const { suggestions, noteCreation, contacts, personNotes, settings, clock, operations, logger } =
    deps

  /**
   * Contacts for the `[[` link menu — v1 mixed contacts into the backlink
   * autocomplete so a person note could be born from the address book. This
   * keeps the framework's word-prefix matches (typing "Ada" should offer "Ada
   * Lovelace"). Queries shorter than two characters answer empty — one letter
   * matches half the address book.
   */
  async function contactLinkSuggestions(query: string): Promise<ContactMatch[]> {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      return []
    }
    return pickContactLinkSuggestions(
      await contacts.lookupByName(trimmed),
      CONTACT_SUGGESTION_LIMIT,
    )
  }

  /**
   * The one user-visible refusal for an `ambiguous` title resolution: several
   * notes may claim the title's exact or fallback key, or an unavailable
   * collision prevents proving uniqueness. Creation may not guess then.
   */
  function reportAmbiguousNoteTitle(title: string): void {
    operations.start('Creating note').fail(ambiguousNoteTitleMessage(title))
  }

  function reportUnavailableNoteTitle(title: string): void {
    operations
      .start('Creating note')
      .fail(
        `Couldn’t create “${title}” while a potentially matching note is unavailable. Try again when it is available on this device.`,
      )
  }

  // The `[[` autocomplete's create row: re-resolve and inspect the title's
  // on-disk slug family before creating. The menu inserts the link text either
  // way; an ambiguous, unavailable, or failed create leaves it unresolved.
  async function resolveOrCreateFromAutocomplete(title: string, generation: number): Promise<void> {
    const outcome = await noteCreation.resolveOrCreateNoteWithTitle(title, generation)
    if (outcome.kind === 'ambiguous') {
      reportAmbiguousNoteTitle(title)
    } else if (outcome.kind === 'unavailable') {
      reportUnavailableNoteTitle(title)
    }
  }

  return {
    async suggestLinks(query, options) {
      const { generation } = options
      const { contactsEnabled, dateFormat, weekStartDay } = settings.get()
      const contactsInMenu =
        contactsEnabled &&
        options.contactsAuthorization !== null &&
        isContactsReadable(options.contactsAuthorization)
      const dateContext = {
        today: localIsoDate(new Date(clock.now())),
        dateFormat,
        weekStartDay,
      }
      const [wikiLinks, contactResolutions] = await Promise.all([
        suggestions.suggestWikiLinkTargets(query, 8, dateContext),
        // A contacts hiccup (permission revoked mid-session, store error)
        // must cost only its own rows, never the note suggestions.
        contactsInMenu
          ? contactLinkSuggestions(query)
              .then((matches) =>
                Promise.all(matches.map((contact) => personNotes.resolvePersonContact(contact))),
              )
              .catch((error: unknown): PersonContactResolution[] => {
                logger.error('contact link suggestions failed:', error)
                return []
              })
          : Promise.resolve<PersonContactResolution[]>([]),
      ])
      const contactCandidates = contactResolutions
        .map((resolution) =>
          resolution.kind === 'blocked'
            ? null
            : {
                contact: resolution.contact,
                target: resolution.insertText,
                ownerPath: resolution.kind === 'existing' ? resolution.path : null,
              },
        )
        .filter(isNotNullish)
      const blockedContactNames = contactResolutions
        .map((resolution) => (resolution.kind === 'blocked' ? resolution.contact.fullName : null))
        .filter(isNotNullish)
      const entries = buildAutocompleteEntries(query, wikiLinks.suggestions, {
        offerCreate: true,
        contacts: contactCandidates,
        blockedContactNames,
        requireSerializableWikiText: true,
        queryReadsAsDate: wikiLinks.queryReadsAsDate,
        claimedTargetKeys: wikiLinks.claimedTargetKeys,
      })
      // Distinct notes can share a title; their rows need the path to tell them apart.
      const titleCounts = new Counter<string>()
      for (const entry of entries) {
        if (entry.kind === 'suggestion' && entry.suggestion.date === null) {
          titleCounts.increment(displayNoteTitle(entry.suggestion.title))
        }
      }
      return entries.map((entry): WikiLinkMenuItem => {
        if (entry.kind === 'create') {
          return {
            target: entry.title,
            label: `Create “${entry.title}”`,
            // Insert happens in the menu; create the note in the background.
            // Best-effort: a failed create just leaves an unresolved link.
            onSelect: () => {
              void resolveOrCreateFromAutocomplete(entry.title, generation).catch(
                (error: unknown) => {
                  logger.error('create-from-autocomplete failed:', error)
                  operations.start('Creating note').fail(errorMessage(error))
                },
              )
            },
          }
        }
        if (entry.kind === 'contact') {
          const { contact } = entry
          return {
            target: entry.target,
            label: contact.fullName,
            detail: contact.emails[0] ?? contact.phones[0] ?? 'Contact',
            onSelect: () => {
              void personNotes
                .ensurePersonNote({
                  title: contact.fullName,
                  emails: contact.emails,
                  body: contactDetailsMarkdown(contact),
                  generation,
                })
                .then((outcome) => {
                  if (outcome.kind === 'ambiguous') {
                    reportAmbiguousNoteTitle(contact.fullName)
                  } else if (outcome.kind === 'unavailable') {
                    reportUnavailableNoteTitle(contact.fullName)
                  }
                })
                .catch((error: unknown) => {
                  logger.error('create-person-note failed:', error)
                  operations.start('Creating note').fail(errorMessage(error))
                })
            },
          }
        }
        const { title, date, path, generated, insertText: target } = entry.suggestion
        // A generated date leads with its phrase ("Next Friday"), resolved day
        // as the detail; everything else keeps the title/alias/daily form.
        if (generated !== undefined && date !== null) {
          return {
            target,
            label: generated.phrase,
            detail: formatDayLabel(date, dateFormat),
          }
        }
        // A rich title reads as its rendered form; the raw form stays the identity.
        const displayedTitle = displayNoteTitle(title)
        const label = date !== null ? formatDayLabel(date, dateFormat) : displayedTitle
        const shownAlias = aliasHint(entry.suggestion)
        const detail =
          shownAlias !== null
            ? `${shownAlias} → ${displayedTitle}`
            : date !== null
              ? path === null
                ? `${date} · new`
                : date
              : path !== null && titleCounts.get(displayedTitle) > 1
                ? path
                : undefined
        return { target, label, ...(detail !== undefined ? { detail } : {}) }
      })
    },

    async suggestTags(query) {
      const tags = await suggestions.suggestTags(query)
      return tags.map((tag) => ({ tag: tag.tag }))
    },
  }
}
