import { defaultOpenDocuments, type NoteSession, type OpenDocument } from '@reflect/core'

/*
 * The open note documents live in `@reflect/core` (`OpenDocumentsService`).
 * Each function here delegates to the process-wide service.
 */

export type { OpenDocument }

/** Register an open document (keyed by its session's path); returns the unregister. */
export function registerOpenDocument(document: OpenDocument): () => void {
  return defaultOpenDocuments().register(document)
}

/** The live session for `path`, if that note is open in some pane. */
export function openSession(path: string): NoteSession | null {
  return defaultOpenDocuments().sessionFor(path)
}

/** Paths of open documents holding unsaved edits right now. */
export function dirtyOpenPaths(): string[] {
  return defaultOpenDocuments().dirtyPaths()
}

/** Ask every open document to reconcile against disk. */
export function reloadOpenDocuments(): void {
  defaultOpenDocuments().reloadAll()
}

/** Re-key an open document after its note file moved (Plan 17). */
export function retargetOpenDocument(from: string, to: string, session: NoteSession): void {
  defaultOpenDocuments().retarget(from, to, session)
}

/** Flush every open buffer and fire each document's pending settle-time work. */
export async function flushOpenDocuments(): Promise<void> {
  await defaultOpenDocuments().flushAll()
}
