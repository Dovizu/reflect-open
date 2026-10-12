import type { ContactMatch } from './contacts-service.ts'
import {
  defaultPersonNotes,
  type EnsurePersonNoteInput,
  type EnsurePersonNoteResult,
  type PersonContactResolution,
} from './person-note-service.ts'

export type {
  BlockedPersonContactResolution,
  BlockedPersonResolution,
  EnsurePersonNoteInput,
  EnsurePersonNoteResult,
  ExistingPersonContactResolution,
  ExistingPersonResolution,
  MissingPersonResolution,
  NewPersonContactResolution,
  PersonContactResolution,
  PersonResolution,
} from './person-note-service.ts'

/** `defaultPersonNotes().resolvePersonContact`. */
export async function resolvePersonContact(
  contact: ContactMatch,
): Promise<PersonContactResolution> {
  return await defaultPersonNotes().resolvePersonContact(contact)
}

/** `defaultPersonNotes().ensurePersonNote`. */
export async function ensurePersonNote(
  input: EnsurePersonNoteInput,
): Promise<EnsurePersonNoteResult> {
  return await defaultPersonNotes().ensurePersonNote(input)
}
