import { defaultNoteCreation, type ResolveOrCreateNoteResult } from './note-creation-service.ts'

export {
  deferredCreationPolicy,
  isUntitledNotePath,
  type DeferredCreationPolicy,
  type ResolveOrCreateNoteResult,
} from './note-creation-service.ts'

/** `defaultNoteCreation().newNoteId`. */
export function newNoteId(): string {
  return defaultNoteCreation().newNoteId()
}

/** `defaultNoteCreation().newNoteSource`. */
export function newNoteSource(title: string, body?: string): string {
  return defaultNoteCreation().newNoteSource(title, body)
}

/** `defaultNoteCreation().untitledNoteSeed`. */
export function untitledNoteSeed(): string {
  return defaultNoteCreation().untitledNoteSeed()
}

/** `defaultNoteCreation().untitledNotePath`. */
export function untitledNotePath(): string {
  return defaultNoteCreation().untitledNotePath()
}

/** `defaultNoteCreation().createNoteWithTitle`. */
export async function createNoteWithTitle(
  title: string,
  generation: number,
  body?: string,
): Promise<string> {
  return await defaultNoteCreation().createNoteWithTitle(title, generation, body)
}

/** `defaultNoteCreation().resolveOrCreateNoteWithTitle`. */
export async function resolveOrCreateNoteWithTitle(
  title: string,
  generation: number,
  body?: string,
): Promise<ResolveOrCreateNoteResult> {
  return await defaultNoteCreation().resolveOrCreateNoteWithTitle(title, generation, body)
}
