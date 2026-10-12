import { ReflectError } from '../errors.ts'
import { defaultNoteCreation, type NoteCreationService } from '../graph/note-creation-service.ts'
import { defaultNoteFile, type NoteFileService } from '../graph/note-file-service.ts'
import { wikiLinkSafe } from '../markdown/edit.ts'
import { parseNote } from '../markdown/extract.ts'

/** The category notes that automatic backlinks point at (`Links`, `Audio memos`). */
export interface BacklinkTargetService {
  /**
   * Resolve the note targeted by an automatic backlink, or create it safely.
   * Existing duplicates use the same sorted-first winner as read-only wiki-link
   * resolution. That ambiguity must not block durable capture, and no new note
   * is created in that case. An unavailable match (an iCloud placeholder or a
   * failed read) must not block capture either: the requested spelling is kept
   * unchanged and resolves once the note is readable on this device. Returns a
   * link-safe current title so renames keep one section; an unsafe title falls
   * back to the requested spelling that just resolved as its alias.
   */
  ensure(title: string, generation: number): Promise<string>
}

export function createBacklinkTargetService(deps: {
  noteCreation: Pick<NoteCreationService, 'resolveOrCreateNoteWithTitle'>
  noteFile: Pick<NoteFileService, 'read'>
}): BacklinkTargetService {
  const { noteCreation, noteFile } = deps
  return {
    async ensure(title, generation) {
      const outcome = await noteCreation.resolveOrCreateNoteWithTitle(title, generation)
      if (outcome.kind === 'unavailable') {
        return title
      }
      const path = outcome.kind === 'ambiguous' ? [...outcome.paths].sort().at(0) : outcome.path
      if (path === undefined) {
        throw new ReflectError('unknown', `The [[${title}]] backlink target could not be resolved.`)
      }
      const source = await noteFile.read(path, generation)
      const currentTitle = parseNote({ path, source }).title
      return wikiLinkSafe(currentTitle) === currentTitle ? currentTitle : title
    },
  }
}

let installedService: BacklinkTargetService | null = null
let fallback: {
  service: BacklinkTargetService
  noteCreation: NoteCreationService
  noteFile: NoteFileService
} | null = null

/**
 * The process-wide `BacklinkTargetService`; one over
 * {@link defaultNoteCreation} and {@link defaultNoteFile} unless
 * {@link setDefaultBacklinkTarget} installed another.
 */
export function defaultBacklinkTarget(): BacklinkTargetService {
  if (installedService !== null) {
    return installedService
  }
  const noteCreation = defaultNoteCreation()
  const noteFile = defaultNoteFile()
  if (fallback?.noteCreation !== noteCreation || fallback.noteFile !== noteFile) {
    fallback = {
      service: createBacklinkTargetService({ noteCreation, noteFile }),
      noteCreation,
      noteFile,
    }
  }
  return fallback.service
}

/** Install the process-wide `BacklinkTargetService`; `null` restores the default-backed one. */
export function setDefaultBacklinkTarget(service: BacklinkTargetService | null): void {
  installedService = service
}
