import type { GraphSessionSource } from '../app/graph-session.ts'
import { errorMessage } from '../errors.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { FileChangeService } from '../indexing/file-change-service.ts'
import type { IndexLifecycleService } from '../indexing/index-lifecycle-service.ts'
import { resolveConflictMarkers, type ConflictResolution } from '../markdown/conflict-markers.ts'

/** What one {@link ConflictResolutionService.resolve} did. */
export interface ConflictResolutionOutcome {
  /**
   * Whether the resolved file reached disk. True even when the reindex step
   * failed afterwards; index-backed views must refresh whenever it is true.
   */
  wrote: boolean
  /** The failure text for the user, or `null` when every step worked. */
  error: string | null
}

/** The services a {@link ConflictResolutionService} runs on. */
export interface ConflictResolutionServiceDeps {
  noteFile: Pick<NoteFileService, 'read' | 'write'>
  indexLifecycle: Pick<IndexLifecycleService, 'indexNote'>
  fileChanges: Pick<FileChangeService, 'emit'>
  graphSession: GraphSessionSource
}

/**
 * Resolution of sync conflict markers for one note, as raw-text surgery:
 * read the file, splice the kept side(s) (`resolveConflictMarkers` — markers
 * don't survive the editor round-trip, so the editor can't do this), write it
 * back, reindex, and notify open sessions. The conflict flag is a projection
 * of the file content, so consumers (the notice banner) clear themselves once
 * the resolved file reindexes.
 */
export interface ConflictResolutionService {
  /**
   * Splice the chosen side(s) into the file of the open graph, reindex it
   * (unless its index failed to open), and notify open sessions. Never
   * rejects; does nothing when no graph is open.
   */
  resolve: (path: string, keep: ConflictResolution) => Promise<ConflictResolutionOutcome>
}

export function createConflictResolutionService(
  deps: ConflictResolutionServiceDeps,
): ConflictResolutionService {
  const { noteFile, indexLifecycle, fileChanges, graphSession } = deps

  return {
    resolve: async (path, keep) => {
      const { session } = graphSession.getState()
      if (session === null) {
        return { wrote: false, error: null }
      }
      const { generation, indexGeneration } = session
      let wrote = false
      let error: string | null = null
      try {
        const source = await noteFile.read(path)
        const resolved = resolveConflictMarkers(source, keep)
        await noteFile.write(path, resolved, generation)
        wrote = true
        if (indexGeneration !== null) {
          await indexLifecycle.indexNote(path, { generation: indexGeneration, content: resolved })
        }
      } catch (caught: unknown) {
        error = errorMessage(caught)
      } finally {
        if (wrote) {
          // The file changed on disk even if the reindex step failed (the
          // watcher will redo that) — reload the open (protected) session,
          // which round-trips again now and reopens editable.
          fileChanges.emit({ changes: [{ path, kind: 'upsert' }], source: 'own-write' })
        }
      }
      return { wrote, error }
    },
  }
}
