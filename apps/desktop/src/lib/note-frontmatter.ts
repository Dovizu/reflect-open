import { defaultNoteDocuments, type FrontmatterPatch } from '@reflect/core'

/*
 * The session-or-disk channel lives in `@reflect/core` (`NoteDocumentService`).
 * Each function here delegates to the process-wide service.
 */

/**
 * The note's current source, read from the freshest authoritative place: the
 * open session's loaded buffer, or disk when no session has it loaded.
 */
export async function readNoteSource(path: string): Promise<string> {
  return await defaultNoteDocuments().readSource(path)
}

/**
 * Land `patch` on the note's frontmatter, returning once it has persisted.
 * Routes through the live session when one can take the patch; otherwise
 * patches disk directly. A patch that changes nothing is a no-op.
 */
export async function commitNoteFrontmatter(
  path: string,
  patch: FrontmatterPatch,
  generation: number,
): Promise<void> {
  await defaultNoteDocuments().commitFrontmatter(path, patch, generation)
}
