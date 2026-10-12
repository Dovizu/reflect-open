import {
  defaultIdService,
  defaultIndexStore,
  defaultNoteFile,
  ensureWelcomeNote as ensureWelcomeNoteWith,
  type EnsureWelcomeNoteOptions,
} from '@reflect/core'

/** Seed the welcome note through the process-wide services. */
export function ensureWelcomeNote(options: EnsureWelcomeNoteOptions): Promise<boolean> {
  return ensureWelcomeNoteWith(
    { indexStore: defaultIndexStore(), noteFile: defaultNoteFile(), id: defaultIdService() },
    options,
  )
}
