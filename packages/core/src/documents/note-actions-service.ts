import { isIsoDate } from '@reflect/utils'
import type { ClipboardService } from '../app/clipboard-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { PathService } from '../app/path-service.ts'
import { errorMessage } from '../errors.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import { dateFromDailyPath, isDaily } from '../graph/paths.ts'
import type { IndexLifecycleService } from '../indexing/index-lifecycle-service.ts'
import type { PinnedNote } from '../indexing/index-query-service.ts'
import { parseNote } from '../markdown/extract.ts'
import { dailyDeepLink, noteDeepLink } from '../navigation/deep-link-format.ts'
import { isPinned } from '../markdown/model.ts'
import type { NoteDocumentService } from './note-document-service.ts'
import type { OpenDocumentsService } from './open-documents-service.ts'
import { isValidPinOrder } from './pin-order.ts'

/**
 * How a deduped, self-reporting note action ended:
 *
 * - `done`: the note was written; the result carries what the note now holds.
 * - `busy`: the same action on the same note is still in flight, so this call
 *   did nothing (its `prepare` did not run).
 * - `failed`: the action failed and reported the error through operations.
 */
export type NoteActionOutcome<Result> =
  | ({ readonly status: 'done' } & Result)
  | { readonly status: 'busy' }
  | { readonly status: 'failed' }

/** What a pin action left in the note's frontmatter. */
export interface NotePinResult {
  readonly pinned: boolean
  /** The written shelf order; `null` for an unpinned note and for a bare `pinned: true`. */
  readonly pinOrder: number | null
}

export interface NotePinToggleOptions {
  /**
   * Runs once the call is accepted (not `busy`), before the note is read: the
   * place for the caller's optimistic feedback. Returns the shelf order the
   * note takes if the toggle pins it, or `null` to write a bare
   * `pinned: true`. A throw fails the action.
   */
  prepare: () => number | null | Promise<number | null>
}

export interface NoteActionOptions {
  /**
   * Runs once the call is accepted (not `busy`), before the note is touched:
   * the place for the caller's optimistic feedback. A throw fails the action.
   */
  prepare?: () => void | Promise<void>
}

/** One pin order that {@link NoteActionsService.reorderPinned} wrote. */
export interface NotePinOrderWrite {
  readonly path: string
  readonly pinOrder: number
}

export interface NoteTrashFailure {
  readonly path: string
  readonly cause: unknown
}

/** Which notes went to the trash and which could not, each in request order. */
export interface NoteTrashResult {
  readonly succeeded: readonly string[]
  readonly failed: readonly NoteTrashFailure[]
}

export interface NoteTrashManyOptions {
  /** Called as each note lands in the trash, before the next one starts. */
  onTrashed?: (path: string) => void
}

/**
 * Whether a note may be moved to the trash. Daily notes are the app's
 * chronological spine and cannot be deleted.
 */
export function canTrashNote(path: string): boolean {
  return !isDaily(path)
}

/**
 * The user's actions on one note that are not edits: pin, private, trash,
 * copy deep link, copy path. Markdown owns the final state; the caller keeps
 * its own optimistic caches and gets back the data to settle them.
 */
export interface NoteActionsService {
  /**
   * Toggle the pin from the state the note's frontmatter holds now. Deduped
   * with {@link NoteActionsService.unpin} per generation and path; a failure
   * is reported as an "Updating pin" operation.
   */
  togglePinned(
    path: string,
    generation: number,
    options: NotePinToggleOptions,
  ): Promise<NoteActionOutcome<NotePinResult>>
  /** Remove a pin directionally, without reading the current pin state. */
  unpin(
    path: string,
    generation: number,
    options?: NoteActionOptions,
  ): Promise<NoteActionOutcome<NotePinResult>>
  /**
   * Write the shelf order of each note that carries a valid one, and return
   * the orders written. Rejects when a write fails.
   */
  reorderPinned(
    notes: ReadonlyArray<Pick<PinnedNote, 'path' | 'pinnedOrder'>>,
    generation: number,
  ): Promise<NotePinOrderWrite[]>
  /**
   * Toggle `private` from the state the note's frontmatter holds now. Deduped
   * per generation and path; a failure is reported as an "Updating privacy"
   * operation.
   */
  togglePrivate(
    path: string,
    generation: number,
    options?: NoteActionOptions,
  ): Promise<NoteActionOutcome<{ readonly isPrivate: boolean }>>
  /** Whether `path` may be moved to the trash; see {@link canTrashNote}. */
  canTrash(path: string): boolean
  /**
   * Delete a regular note and detach its editor session without flushing.
   *
   * The file goes to the trash: the OS-native trash on desktop, the
   * graph-local `.reflect/trash/` on mobile (which has no OS trash). It is
   * recoverable either way, and sync-ignored. The index and queries drop the
   * note once the change lands (the desktop watcher's reindex, or the mobile
   * write echo). Daily notes are intentionally blocked.
   *
   * The session first pauses persistence and settles its initial load plus any
   * write already in flight. A lazy-created note that still has no backing file
   * is deleted by discarding that session alone. Otherwise delete first, discard
   * second. If the filesystem delete fails, persistence resumes so the mounted
   * editor remains intact. Only once the file is in trash do we discard the
   * session; otherwise a normal teardown flush could recreate the deleted file.
   *
   * Never rejects and reports nothing: a failure comes back in `failed`.
   */
  trash(path: string, generation: number): Promise<NoteTrashResult>
  /**
   * {@link NoteActionsService.trash} for each path in order, under one
   * "Trashing notes" operation. A failure is recorded, not rethrown
   * mid-batch, so the remaining notes still trash; the operation then fails
   * with the last error.
   */
  trashMany(
    paths: readonly string[],
    generation: number,
    options?: NoteTrashManyOptions,
  ): Promise<NoteTrashResult>
  /**
   * The most durable deep link the note can have. A daily note is addressed
   * by its date. A regular note is addressed by its frontmatter `id`, minted
   * here on first use for notes that predate Plan 17's ids or were created
   * outside Reflect, so the link survives every rename; the id lands through
   * the session-or-disk frontmatter channel like pin and private do.
   */
  deepLinkFor(path: string, generation: number): Promise<string>
  /**
   * Build the deep link, put it on the clipboard, and confirm through the
   * operations status line. Never rejects.
   */
  copyDeepLink(path: string, generation: number): Promise<void>
  /**
   * Resolve the graph-relative `path` to an absolute filesystem path for use
   * in tools outside Reflect (agent chats, editors, terminals), put it on the
   * clipboard, and report through the operations status line. Joining through
   * the host preserves the host platform's path syntax. Never rejects.
   */
  copyPath(root: string | null, path: string): Promise<void>
}

export function createNoteActionsService(deps: {
  noteDocuments: NoteDocumentService
  noteFile: Pick<NoteFileService, 'delete'>
  openDocuments: Pick<OpenDocumentsService, 'sessionFor'>
  indexLifecycle: Pick<IndexLifecycleService, 'indexNote'>
  operations: OperationsService
  clipboard: ClipboardService
  path: Pick<PathService, 'join'>
  id: Pick<IdService, 'noteId'>
}): NoteActionsService {
  const {
    noteDocuments,
    noteFile,
    openDocuments,
    indexLifecycle,
    operations,
    clipboard,
    path: pathService,
    id,
  } = deps
  const pendingPins = new Set<string>()
  const pendingPrivacy = new Set<string>()

  async function updatePin(
    path: string,
    generation: number,
    prepare: () => Promise<number | null | false>,
  ): Promise<NoteActionOutcome<NotePinResult>> {
    const key = JSON.stringify([generation, path])
    if (pendingPins.has(key)) {
      return { status: 'busy' }
    }
    pendingPins.add(key)
    try {
      // `false` unpins; a number or `null` is the order a toggle pins with.
      const order = await prepare()
      const pinned =
        order === false
          ? false
          : !isPinned(parseNote({ path, source: await noteDocuments.readSource(path) }).frontmatter)
      const pinOrder = pinned && order !== false ? order : null
      await noteDocuments.commitFrontmatter(
        path,
        { pinned: pinned ? (pinOrder ?? true) : false },
        generation,
      )
      return { status: 'done', pinned, pinOrder }
    } catch (cause) {
      operations.start('Updating pin').fail(errorMessage(cause))
      return { status: 'failed' }
    } finally {
      pendingPins.delete(key)
    }
  }

  async function trashOne(path: string, generation: number): Promise<void> {
    if (!canTrashNote(path)) {
      throw new Error('Daily notes cannot be deleted')
    }
    const session = openDocuments.sessionFor(path)
    const unpersisted = await session?.prepareDelete()
    if (session !== null && unpersisted === true) {
      session.discard()
      return
    }
    try {
      await noteFile.delete(path, generation)
    } catch (cause) {
      session?.cancelDelete()
      throw cause
    }
    session?.discard()
    const currentSession = openDocuments.sessionFor(path)
    if (currentSession !== session) {
      currentSession?.discard()
    }
  }

  async function deepLinkFor(path: string, generation: number): Promise<string> {
    if (isDaily(path)) {
      const date = dateFromDailyPath(path)
      // Calendar-validated like the router: a daily/ file with an impossible
      // date (2026-02-31) routes as a plain note everywhere else, so it gets a
      // note address too: a date form would be a link the parser rejects.
      if (date !== null && isIsoDate(date)) {
        return dailyDeepLink(date)
      }
    }
    const source = await noteDocuments.readSource(path)
    // A blank `id:` counts as no id (same rule as the CLI's `reflect open`):
    // linking it would emit `reflect://note/`, which the parser rejects.
    const existing = parseNote({ path, source }).frontmatter.id
    if (existing !== undefined && existing.trim() !== '') {
      return noteDeepLink(existing)
    }
    const minted = id.noteId()
    await noteDocuments.commitFrontmatter(path, { id: minted }, generation)
    // Resolution reads the index, which trails local writes by a watcher
    // debounce: index the mint now so the copied link resolves immediately.
    // Best-effort: the watcher pass covers this on its own schedule anyway.
    try {
      await indexLifecycle.indexNote(path, { generation })
    } catch {
      // the copied link still works once the watcher reindexes the note
    }
    return noteDeepLink(minted)
  }

  return {
    async togglePinned(path, generation, options) {
      return await updatePin(path, generation, async () => await options.prepare())
    },
    async unpin(path, generation, options) {
      return await updatePin(path, generation, async () => {
        await options?.prepare?.()
        return false
      })
    },
    async reorderPinned(notes, generation) {
      const written = await Promise.all(
        notes.map(async (note): Promise<NotePinOrderWrite | null> => {
          const order = note.pinnedOrder
          if (!isValidPinOrder(order)) {
            return null
          }
          await noteDocuments.commitFrontmatter(note.path, { pinned: order }, generation)
          return { path: note.path, pinOrder: order }
        }),
      )
      return written.filter((write) => write !== null)
    },
    async togglePrivate(path, generation, options) {
      const key = JSON.stringify([generation, path])
      if (pendingPrivacy.has(key)) {
        return { status: 'busy' }
      }
      pendingPrivacy.add(key)
      try {
        await options?.prepare?.()
        const source = await noteDocuments.readSource(path)
        const isPrivate = !parseNote({ path, source }).frontmatter.private
        await noteDocuments.commitFrontmatter(path, { private: isPrivate }, generation)
        return { status: 'done', isPrivate }
      } catch (cause) {
        operations.start('Updating privacy').fail(errorMessage(cause))
        return { status: 'failed' }
      } finally {
        pendingPrivacy.delete(key)
      }
    },
    canTrash: canTrashNote,
    async trash(path, generation) {
      try {
        await trashOne(path, generation)
        return { succeeded: [path], failed: [] }
      } catch (cause) {
        return { succeeded: [], failed: [{ path, cause }] }
      }
    },
    async trashMany(paths, generation, options) {
      const succeeded: string[] = []
      const failed: NoteTrashFailure[] = []
      if (paths.length === 0) {
        return { succeeded, failed }
      }
      const operation = operations.start('Trashing notes')
      operation.progress(0, paths.length)
      let attempted = 0
      for (const path of paths) {
        try {
          await trashOne(path, generation)
          options?.onTrashed?.(path)
          succeeded.push(path)
        } catch (cause) {
          failed.push({ path, cause })
        }
        attempted += 1
        operation.progress(attempted, paths.length)
      }
      const last = failed.at(-1)
      if (last === undefined) {
        operation.done()
      } else {
        operation.fail(errorMessage(last.cause))
      }
      return { succeeded, failed }
    },
    deepLinkFor,
    async copyDeepLink(path, generation) {
      let url: string
      try {
        url = await deepLinkFor(path, generation)
      } catch (cause) {
        operations.start('Copying deep link').fail(errorMessage(cause))
        return
      }
      try {
        await clipboard.writeText(url)
        operations.start('Deep link copied').done()
      } catch (cause) {
        operations.start('Copying deep link').fail(errorMessage(cause))
      }
    },
    async copyPath(root, path) {
      if (root === null) {
        operations.start('Copying note path').fail('No graph is open')
        return
      }
      try {
        const absolutePath = await pathService.join(root, path)
        await clipboard.writeText(absolutePath)
        operations.start('Note path copied').done()
      } catch (cause) {
        operations.start('Copying note path').fail(errorMessage(cause))
      }
    },
  }
}
