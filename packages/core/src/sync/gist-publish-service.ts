import { defaultClipboard, type ClipboardService } from '../app/clipboard-service.ts'
import { defaultOperations, type OperationsService } from '../app/operations-service.ts'
import {
  defaultNoteDocuments,
  type NoteDocumentService,
} from '../documents/note-document-service.ts'
import { defaultNoteRows, type NoteRowService } from '../documents/note-row-service.ts'
import { errorMessage, ReflectError } from '../errors.ts'
import { parseNote } from '../markdown/extract.ts'
import { splitFrontmatter } from '../markdown/frontmatter.ts'
import { gistBodyHash, gistFilename } from '../markdown/gist.ts'
import type { GistFrontmatter } from '../markdown/model.ts'
import { defaultPrivacy, type PrivacyService } from '../privacy/privacy-service.ts'
import { defaultGists, type GistService } from './gist-service.ts'
import { defaultGithubAuth, type GithubAuthService } from './github-auth-service.ts'

/**
 * What a gist action left on the note's index row: the fields the action
 * also recorded in the optimistic row overlay.
 */
export interface GistPublishResult {
  /** The gist page url; `null` after an unpublish. */
  readonly url: string | null
  /** Whether the published body lags the note. Fresh after either action. */
  readonly stale: boolean
}

/** Publishing a note as a secret GitHub gist, and taking it down again. */
export interface GistPublishService {
  /**
   * Publish a note's body to a GitHub Gist (always secret), recording the gist
   * in the note's `gist` frontmatter block, and return the gist url. A note
   * that already carries the block republishes to the **same** gist,
   * addressing the file by the name it was last published under, so a title
   * change renames instead of adding a second file. A gist deleted on
   * github.com falls back to creating a fresh one. The stored hash is of the
   * body as published, so the indexer's `gist_stale` reflects real edits,
   * never the frontmatter write itself.
   *
   * Reads and writes through `NoteDocumentService`, exactly like the
   * pin/private toggles: a direct disk write under a dirty buffer would park
   * a conflict caused by our own action, and a still-loading session is read
   * from disk rather than from its empty placeholder buffer.
   *
   * `private: true` is the hard block: the gate runs on the content actually
   * being published (live, not the possibly-lagging index), and it fails
   * closed before any byte leaves the device.
   */
  publishNote(path: string, generation: number): Promise<string>
  /**
   * Delete the note's published GitHub Gist and remove the local `gist`
   * frontmatter block. A missing local block is already unpublished, so this
   * is a no-op. The local record is cleared before the remote delete, so a
   * local write failure cannot leave Reflect pointing at a dead link. If
   * GitHub rejects the delete, the local block is restored before the error
   * is surfaced.
   */
  unpublishNote(path: string, generation: number): Promise<void>
  /**
   * The publish action as every entry point runs it (Note actions button,
   * ⌘K command): publish, copy the gist link, and surface progress through
   * the operations status line. The second short-lived entry is the only
   * success feedback ("Gist link copied"), in keeping with no-toast feedback.
   * Resolves the row fields whenever the publish itself landed (a failed
   * clipboard copy gets its own failure line, never a phantom "publish
   * failed" for a gist that exists), or `null` when the publish failed
   * (already surfaced) or another gist action on the note is in flight.
   *
   * On success it records the url in the optimistic note-row overlay, so every
   * sidebar surface (the gist action's label, the Published URL section)
   * reflects the publish immediately, before the watcher re-indexes the file.
   */
  publish(path: string, generation: number): Promise<GistPublishResult | null>
  /**
   * The unpublish action as the sidebar runs it: delete the remote gist, clear
   * the local gist metadata, and hide the published URL optimistically while
   * the index catches up. Resolves `null` when it failed (already surfaced) or
   * another gist action on the note is in flight.
   */
  unpublish(path: string, generation: number): Promise<GistPublishResult | null>
}

export function createGistPublishService(deps: {
  gists: GistService
  githubAuth: Pick<GithubAuthService, 'getToken'>
  noteDocuments: Pick<NoteDocumentService, 'readSource' | 'commitFrontmatter'>
  noteRows: Pick<NoteRowService, 'setOverlay'>
  privacy: Pick<PrivacyService, 'assertCloudAllowed'>
  operations: Pick<OperationsService, 'start'>
  clipboard: ClipboardService
}): GistPublishService {
  const { gists, githubAuth, noteDocuments, noteRows, privacy, operations, clipboard } = deps
  const active = new Set<string>()

  function claim(path: string): boolean {
    if (active.has(path)) {
      operations
        .start('Gist operation already running')
        .fail('Wait for the current gist operation to finish')
      return false
    }
    active.add(path)
    return true
  }

  async function publishNote(path: string, generation: number): Promise<string> {
    const source = await noteDocuments.readSource(path)
    const parsed = parseNote({ path, source })
    privacy.assertCloudAllowed({ path, isPrivate: parsed.frontmatter.private })

    // The gist must be recorded in frontmatter or the next publish forks a new
    // one — and `upsertFrontmatter` rightly refuses to rewrite a header it
    // can't parse. That refusal must come *before* the gist exists, not after.
    if (parsed.frontmatterWarning !== undefined) {
      throw new ReflectError('parse', 'The note has invalid frontmatter — fix it before publishing')
    }

    const body = splitFrontmatter(source).body
    if (body.trim() === '') {
      throw new ReflectError('io', 'The note is empty — nothing to publish')
    }

    const token = await githubAuth.getToken()
    if (token === null) {
      throw new ReflectError('auth', 'Connect GitHub in Settings to publish gists')
    }

    const filename = gistFilename(parsed.title)
    const previous = parsed.frontmatter.gist
    const published =
      (previous !== undefined
        ? await gists.update(token, previous.id, previous.file, { name: filename, content: body })
        : null) ?? (await gists.create(token, { name: filename, content: body }))

    const gist: GistFrontmatter = {
      id: published.id,
      url: published.htmlUrl,
      file: filename,
      hash: gistBodyHash(body),
    }
    try {
      await noteDocuments.commitFrontmatter(path, { gist }, generation)
    } catch (cause) {
      // The remote and local halves can't be atomic; compensate instead. A
      // *freshly created* gist with no local record would be orphaned (and
      // re-created on the next publish), so best-effort delete it. A failed
      // *republish* record keeps the old block — same gist next time — and the
      // existing gist must never be deleted out from under its shared link.
      if (previous === undefined || published.id !== previous.id) {
        try {
          await gists.delete(token, published.id)
        } catch {
          // Best effort — the publish failure below is the error that matters.
        }
      }
      throw cause
    }
    return published.htmlUrl
  }

  async function unpublishNote(path: string, generation: number): Promise<void> {
    const source = await noteDocuments.readSource(path)
    const parsed = parseNote({ path, source })
    if (parsed.frontmatterWarning !== undefined) {
      throw new ReflectError(
        'parse',
        'The note has invalid frontmatter — fix it before unpublishing',
      )
    }

    const previous = parsed.frontmatter.gist
    if (previous === undefined) {
      return
    }

    const token = await githubAuth.getToken()
    if (token === null) {
      throw new ReflectError('auth', 'Connect GitHub in Settings to unpublish gists')
    }

    await noteDocuments.commitFrontmatter(path, { gist: false }, generation)
    try {
      await gists.delete(token, previous.id)
    } catch (cause) {
      await noteDocuments.commitFrontmatter(path, { gist: previous }, generation)
      throw cause
    }
  }

  return {
    publishNote,
    unpublishNote,
    async publish(path, generation) {
      if (!claim(path)) {
        return null
      }
      try {
        const operation = operations.start('Publishing gist')
        let url: string
        try {
          url = await publishNote(path, generation)
        } catch (cause) {
          operation.fail(errorMessage(cause))
          return null
        }
        operation.done()
        // Stamp the optimism with the publishing graph's generation, so a publish
        // that resolves after a graph switch can't surface on the new graph.
        const result = { url, stale: false }
        noteRows.setOverlay(path, generation, { gistUrl: result.url, gistStale: result.stale })
        try {
          await clipboard.writeText(url)
          operations.start('Gist link copied').done()
        } catch (cause) {
          operations.start('Copying the gist link').fail(errorMessage(cause))
        }
        return result
      } finally {
        active.delete(path)
      }
    },
    async unpublish(path, generation) {
      if (!claim(path)) {
        return null
      }
      try {
        const operation = operations.start('Unpublishing gist')
        try {
          await unpublishNote(path, generation)
        } catch (cause) {
          operation.fail(errorMessage(cause))
          return null
        }
        operation.done()
        const result = { url: null, stale: false }
        noteRows.setOverlay(path, generation, { gistUrl: result.url, gistStale: result.stale })
        return result
      } finally {
        active.delete(path)
      }
    },
  }
}

let installedService: GistPublishService | null = null
let fallback: GistPublishService | null = null

/**
 * The process-wide `GistPublishService`. Unless one is installed, it runs over
 * the default services, each resolved per call, so one instance holds the
 * per-note lock however the defaults are replaced.
 */
export function defaultGistPublish(): GistPublishService {
  if (installedService !== null) {
    return installedService
  }
  fallback ??= createGistPublishService({
    gists: {
      create: async (token, file) => await defaultGists().create(token, file),
      update: async (token, gistId, previousFilename, file) =>
        await defaultGists().update(token, gistId, previousFilename, file),
      delete: async (token, gistId) => {
        await defaultGists().delete(token, gistId)
      },
    },
    githubAuth: { getToken: async () => await defaultGithubAuth().getToken() },
    noteDocuments: {
      readSource: async (path) => await defaultNoteDocuments().readSource(path),
      commitFrontmatter: async (path, patch, generation) => {
        await defaultNoteDocuments().commitFrontmatter(path, patch, generation)
      },
    },
    noteRows: {
      setOverlay: (path, generation, patch) => {
        defaultNoteRows().setOverlay(path, generation, patch)
      },
    },
    privacy: {
      assertCloudAllowed: (note) => {
        defaultPrivacy().assertCloudAllowed(note)
      },
    },
    operations: { start: (label, options) => defaultOperations().start(label, options) },
    clipboard: { writeText: async (text) => await defaultClipboard().writeText(text) },
  })
  return fallback
}

/** Install the process-wide `GistPublishService`; `null` restores the one over the defaults. */
export function setDefaultGistPublish(service: GistPublishService | null): void {
  installedService = service
}
