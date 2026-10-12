import { isAppError } from '../errors.ts'
import { defaultNoteFile, type NoteFileService } from '../graph/note-file-service.ts'
import { splitFrontmatter, upsertFrontmatter } from '../markdown/frontmatter.ts'
import { frontmatterPatchToYaml, type FrontmatterPatch } from './note-session-frontmatter.ts'
import { defaultOpenDocuments, type OpenDocumentsService } from './open-documents-service.ts'

/**
 * The single safe way to read and write a note from an in-app action (pin,
 * private, gist publish): the open session when there is one, otherwise the
 * disk. Each action used to hand-roll the same session-or-disk dance; the two
 * sharp edges live here once:
 *
 * - **Reads** prefer the open session's *loaded* buffer, never a still-loading
 *   one. A loading session reports `liveContent() === null` (its empty buffer
 *   isn't the truth yet), so we fall back to disk rather than act on a
 *   placeholder — the trap behind empty publishes and mis-read toggle states.
 * - **Writes** go through the session when it can take the patch (so our own
 *   write never parks a conflict under a dirty buffer), else a read-patch-write
 *   on disk that a loading/clean session reconciles like any external edit.
 *   Both encode the flag through {@link frontmatterPatchToYaml}, so a value
 *   lands identically whichever channel wins.
 */
export interface NoteDocumentService {
  /**
   * The note's current source, read from the freshest authoritative place: the
   * open session's loaded buffer, or disk when no session has it loaded. A
   * missing file reads as an empty note.
   */
  readSource(path: string): Promise<string>
  /**
   * Read an existing note without disturbing its editor session.
   *
   * An open session's live buffer is newer than disk and can be read without
   * reconciling pending native input (unlike `NoteEditorHandle.getMarkdown`). A
   * closed note falls back to a generation-pinned read so a graph switch cannot
   * return content from the newly active graph.
   */
  readExisting(path: string, generation: number): Promise<string>
  /**
   * Land `patch` on the note's frontmatter, returning once it has persisted.
   * Routes through the live session when one can take the patch; otherwise
   * patches disk directly. A patch that changes nothing is a no-op.
   */
  commitFrontmatter(path: string, patch: FrontmatterPatch, generation: number): Promise<void>
  /** {@link isOstensiblyEmptyNoteSource}. */
  isOstensiblyEmpty(source: string): boolean
}

/**
 * Whether a note's visible markdown body has no authored content. Frontmatter
 * is metadata and does not count; a bare unordered-list marker is also empty
 * because daily notes can open on a starter bullet before the user types.
 */
export function isOstensiblyEmptyNoteSource(source: string): boolean {
  const { body } = splitFrontmatter(source)
  return body.replaceAll(/[-+*#>[\]\s]/g, '') === ''
}

export function createNoteDocumentService(deps: {
  openDocuments: OpenDocumentsService
  noteFile: NoteFileService
}): NoteDocumentService {
  const { openDocuments, noteFile } = deps

  /**
   * The note's content, where a missing file reads as an empty note — the lazy
   * contract: dailies (and ⌘N notes) are valid frontmatter-toggle targets before
   * their file exists, and the toggle's write is what creates the file. Covers
   * the gap where the pane's session exists but can't take patches yet (still
   * loading) — its post-load reconcile then adopts our write like any external
   * change.
   */
  async function readOrEmpty(path: string): Promise<string> {
    try {
      return await noteFile.read(path)
    } catch (cause) {
      if (isAppError(cause) && cause.kind === 'notFound') {
        return ''
      }
      throw cause
    }
  }

  return {
    async readSource(path) {
      return openDocuments.sessionFor(path)?.liveContent() ?? (await readOrEmpty(path))
    },
    async readExisting(path, generation) {
      const session = openDocuments.sessionFor(path)
      if (session !== null) {
        const liveContent = session.liveContent()
        if (liveContent !== null) {
          // The index and open-document registry can briefly outlive an external
          // delete or iCloud eviction. Prove the generation-pinned file is still
          // locally readable before publishing a live buffer; the already-mounted
          // watcher guards changes that race this read.
          await noteFile.read(path, generation)
          return liveContent
        }
      }
      return await noteFile.read(path, generation)
    },
    async commitFrontmatter(path, patch, generation) {
      const owner = openDocuments.sessionFor(path)
      if (owner !== null && (await owner.commitFrontmatter(patch))) {
        return
      }
      const onDisk = await readOrEmpty(path)
      const patched = upsertFrontmatter(onDisk, frontmatterPatchToYaml(patch))
      if (patched !== onDisk) {
        await noteFile.write(path, patched, generation)
      }
    },
    isOstensiblyEmpty: isOstensiblyEmptyNoteSource,
  }
}

let installedService: NoteDocumentService | null = null
let fallback: {
  service: NoteDocumentService
  openDocuments: OpenDocumentsService
  noteFile: NoteFileService
} | null = null

/**
 * The process-wide `NoteDocumentService`; one over {@link defaultOpenDocuments}
 * and {@link defaultNoteFile} unless {@link setDefaultNoteDocuments} installed
 * another.
 */
export function defaultNoteDocuments(): NoteDocumentService {
  if (installedService !== null) {
    return installedService
  }
  const openDocuments = defaultOpenDocuments()
  const noteFile = defaultNoteFile()
  if (fallback?.openDocuments !== openDocuments || fallback.noteFile !== noteFile) {
    fallback = {
      service: createNoteDocumentService({ openDocuments, noteFile }),
      openDocuments,
      noteFile,
    }
  }
  return fallback.service
}

/**
 * Install the process-wide `NoteDocumentService`; `null` restores the one over
 * the default open documents and note file.
 */
export function setDefaultNoteDocuments(service: NoteDocumentService | null): void {
  installedService = service
}
