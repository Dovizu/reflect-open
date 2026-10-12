import type { Unlisten } from '../ipc/ipc-service.ts'
import type { NoteSession } from './note-session-types.ts'

export interface OpenDocument {
  session: NoteSession
  /** Fire pending settle-time work (title renames) now. */
  settle?: () => void
  /** Resolves once fired settle-time work has landed. */
  settled?: () => Promise<void>
}

/**
 * The open note documents, as one app-global service (foundations hardening,
 * post-Plan-07). This consolidates what used to be two parallel registries —
 * a quit-flush list and a path→session lookup — because they were both views
 * of the same fact: *these documents are open right now*.
 *
 * Consumers:
 * - **Quit teardown** ({@link OpenDocumentsService.flushAll}): every buffer
 *   flushes, and each document's settle-time work (pending title renames)
 *   fires and is awaited — the webview must not die before the writes land.
 *   React unmount effects never run on the quit paths, which is why this
 *   lives outside React.
 * - **Work that outlives a pane** ({@link OpenDocumentsService.sessionFor}):
 *   the rename coordinator's alias placement discovers whether its note is
 *   open (possibly *reopened* in a new pane) and routes through the live
 *   session's frontmatter channel instead of racing the disk under a dirty
 *   buffer.
 */
export interface OpenDocumentsService {
  /**
   * Register an open document (keyed by its session's path); returns the
   * unregister. Unregistration is by **identity**, not key — a rename can
   * re-key the entry ({@link OpenDocumentsService.retarget}) between
   * registration and teardown, and the unregister must still find it.
   */
  register(document: OpenDocument): Unlisten
  /** The live session for `path`, if that note is open in some pane. */
  sessionFor(path: string): NoteSession | null
  /**
   * Paths of open documents holding unsaved edits right now. The iCloud
   * conflict sweep (Plan 21) defers these — the session's own conflict parking
   * protects the buffer regardless, but skipping avoids churning a note the
   * user is mid-thought in.
   */
  dirtyPaths(): string[]
  /**
   * Ask every open document to reconcile against disk, exactly as if a watcher
   * upsert had arrived for its path: an unchanged file is a no-op, a clean
   * buffer adopts silently, a dirty buffer parks the conflict banner. The index
   * lifecycle calls this after each completed reconcile pass, because the pass
   * reads changed files into the index without emitting per-file events. On iOS
   * there is no file watcher, so a resume reconcile is the only signal a remote
   * edit produces: without this, an open note keeps stale content until relaunch.
   */
  reloadAll(): void
  /**
   * Re-key an open document after its note file moved (Plan 17), so
   * {@link OpenDocumentsService.sessionFor} lookups under the new path find
   * the live session. The entry moves only when it actually holds `session` —
   * a failed move's compensating re-key must never grab a *different* pane's
   * document that legitimately sits at `from` (then quit-time flush and
   * `sessionFor` would target the wrong path). The old registration's
   * unregister closure stays correct either way (it checks identity, not
   * keys), and the adopting pane re-registers under the new path.
   */
  retarget(from: string, to: string, session: NoteSession): void
  /**
   * Flush every open buffer, fire each document's pending settle-time work, and
   * settle once all of it has landed. Failures are surfaced per-document by the
   * save pipeline already; teardown must proceed past them, so rejections are
   * absorbed, never re-thrown.
   */
  flushAll(): Promise<void>
}

export function createOpenDocumentsService(): OpenDocumentsService {
  const documents = new Map<string, OpenDocument>()

  return {
    register(document) {
      documents.set(document.session.path, document)
      return () => {
        for (const [key, registered] of documents) {
          if (registered === document) {
            documents.delete(key)
            return
          }
        }
      }
    },
    sessionFor(path) {
      return documents.get(path)?.session ?? null
    },
    dirtyPaths() {
      return [...documents.values()]
        .filter((document) => document.session.isDirty())
        .map((document) => document.session.path)
    },
    reloadAll() {
      for (const document of documents.values()) {
        document.session.externalChanged()
      }
    },
    retarget(from, to, session) {
      const document = documents.get(from)
      if (document !== undefined && document.session === session) {
        documents.delete(from)
        documents.set(to, document)
      }
    },
    async flushAll() {
      await Promise.allSettled(
        [...documents.values()].map(async (document) => {
          await document.session.flush()
          // Settle after the flush so the rename tracker has seen the final title;
          // settle() appends the rewrite synchronously, settled() awaits it.
          document.settle?.()
          await document.settled?.()
        }),
      )
    },
  }
}

let installedService: OpenDocumentsService | null = null
let fallback: OpenDocumentsService | null = null

/**
 * The process-wide `OpenDocumentsService`; a lazily created registry unless
 * {@link setDefaultOpenDocuments} installed another.
 */
export function defaultOpenDocuments(): OpenDocumentsService {
  if (installedService !== null) {
    return installedService
  }
  fallback ??= createOpenDocumentsService()
  return fallback
}

/** Install the process-wide `OpenDocumentsService`; `null` restores the lazily created one. */
export function setDefaultOpenDocuments(service: OpenDocumentsService | null): void {
  installedService = service
}
