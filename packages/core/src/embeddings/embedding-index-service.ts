import { z } from 'zod'
import type { HashService } from '../app/hash-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { LocalNoteRead, NoteFileService } from '../graph/note-file-service.ts'
import { isNotePath, isTemplatePath } from '../graph/paths.ts'
import { createAssetDescriptionText } from '../indexing/asset-description-text.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import type { IndexLifecycleService } from '../indexing/index-lifecycle-service.ts'
import type { IpcBridgeService, Unlisten } from '../ipc/ipc-service.ts'
import { parseNote } from '../markdown/index.ts'
import { chunkAssetDescriptions, chunkNote } from './chunk.ts'
import type { EmbeddingRuntimeService } from './embedding-runtime-service.ts'

/**
 * The incremental embedding pass (Plan 09): chunk a note, diff chunk hashes
 * against the stored rows, embed only what changed, and apply as one
 * generation-pinned write. TS owns this orchestration (Rust supplies
 * `embed_texts` + the table writes), mirroring the indexing pipeline.
 *
 * A note's chunk set also carries its referenced assets' description bodies
 * (Plan 20 → semantic leg), mirroring the FTS fold — so a meaning-level query
 * about an image or PDF's contents surfaces the referencing note on the
 * semantic side of hybrid retrieval, not just on keyword matches.
 */

export interface EmbedNoteOptions {
  path: string
  generation: number
  /** The model recorded per vector (from the runtime's `ready` status). */
  modelId: string
  /** Pre-loaded content (the watcher path has it); read from disk if absent. */
  content?: string
}

/** One chunk in the `embed_apply` payload; `vector` only for new/changed. */
export interface EmbedChunkPayload {
  heading: string | null
  posFrom: number
  posTo: number
  text: string
  contentHash: string
  modelId: string
  vector: number[] | null
}

/** How a backfill ended: every note visited, stopped by `isStale`, or the note list unreadable. */
export type EmbeddingBackfillResult = 'completed' | 'aborted' | 'failed'

export interface EmbeddingBackfillOptions {
  generation: number
  modelId: string
  onProgress?: (done: number, total: number) => void
  /** Abort between notes (e.g. graph switch). */
  isStale?: () => boolean
}

/** Keeps each note's chunk vectors current (Plan 09). */
export interface EmbeddingIndexService {
  /**
   * Bring one note's embeddings up to date. Returns the number of chunks that
   * were (re)embedded — 0 means the hash-skip caught everything.
   */
  embedNote(options: EmbedNoteOptions): Promise<number>
  /** Drop a deleted note's chunks + vectors (generation-pinned). */
  removeNote(path: string, generation: number): Promise<void>
  /**
   * Backfill every indexed note (initial enable, repair). Serialized; the
   * hash-skip makes re-runs cheap. Reports per-note progress. One note's
   * failure is logged and the pass goes on; the pass never rejects.
   */
  backfill(options: EmbeddingBackfillOptions): Promise<EmbeddingBackfillResult>
  /**
   * Keep the index at `generation` embedded with `modelId` until the returned
   * function is called: one backfill, then every applied index batch (changed
   * notes re-embed, removed notes drop their vectors). The work runs on one
   * serial queue that outlives each call, so passes never interleave; work
   * still queued when the follow stops is skipped.
   *
   * The trigger is the post-apply signal, not the raw watcher stream.
   * Ordering: `embed_apply` drops chunks for paths without a `notes` row, so
   * embedding a brand-new note off the raw file event could race its index
   * apply and lose the chunks until the next backfill; post-apply, the row is
   * always there. Coverage: asset description writes re-index their
   * referencing notes *outside* the watcher pipeline and emit the same
   * signal, and those notes must re-embed for the description text to reach
   * semantic search.
   */
  follow(options: { generation: number; modelId: string }): Unlisten
}

const voidSchema = z.null()

export function createEmbeddingIndexService(deps: {
  ipc: IpcBridgeService
  embeddingRuntime: EmbeddingRuntimeService
  noteFile: NoteFileService
  database: DatabaseService
  indexLifecycle: IndexLifecycleService
  hash: Pick<HashService, 'sha256Hex'>
  logger: LoggerService
}): EmbeddingIndexService {
  const { ipc, embeddingRuntime, noteFile, database, indexLifecycle, hash, logger } = deps
  const assetDescriptionText = createAssetDescriptionText({ noteFile })
  let queue: Promise<void> = Promise.resolve()

  /** Replace a note's chunk set (hash-diff applied in Rust; generation-pinned). */
  async function applyChunks(
    path: string,
    chunks: EmbedChunkPayload[],
    generation: number,
  ): Promise<void> {
    await ipc.call('embed_apply', { path, chunks, generation }, voidSchema)
  }

  async function removeNote(path: string, generation: number): Promise<void> {
    await ipc.call('embed_remove', { path, generation }, voidSchema)
  }

  async function embedNote(options: EmbedNoteOptions): Promise<number> {
    const { path, generation, modelId } = options
    if (isTemplatePath(path)) {
      return 0 // templates are boilerplate — never embedded, never retrieved
    }
    let content = options.content
    if (content === undefined) {
      let read: LocalNoteRead
      try {
        read = await noteFile.readLocal(path)
      } catch {
        return 0 // deleted between event and read; the remove path handles it
      }
      if (read.kind === 'evicted') {
        // iCloud-evicted: reading would force an on-demand download, and the
        // backfill sweeping a whole evicted graph would turn into thousands of
        // serial blocking downloads. The pre-eviction vectors stay valid (rows
        // survive eviction); if the note re-materializes with new content, the
        // index-applied follow-up re-embeds it then.
        return 0
      }
      content = read.content
    }

    const parsed = parseNote({ path, source: content })
    const gathered = await assetDescriptionText.gatherBodies(
      parsed.assets.map((asset) => asset.path),
    )
    if (gathered.evicted.length > 0) {
      // A referenced sidecar is iCloud-evicted. `embed_apply` replaces the
      // note's *entire* chunk set, so applying without that sidecar's body
      // would silently drop its previously embedded chunks — and sidecars are
      // untracked by the watcher, so nothing would ever restore them. Skip the
      // whole note this pass; the stored vectors stay valid until the sidecar
      // is local again.
      return 0
    }
    const chunks = [
      ...(await chunkNote({ hash }, path, content, parsed)),
      ...(await chunkAssetDescriptions({ hash }, gathered.bodies, content.length + 1)),
    ]
    if (chunks.length === 0) {
      await removeNote(path, generation)
      return 0
    }

    // Stored hash+model pairs, **counted**: duplicate identical sections mean
    // several chunks can share one hash, and only as many may skip embedding as
    // there are stored rows to pair with (apply_chunks pairs one row per
    // skipped chunk — an unmatched skip is a loud error). A model change makes
    // every chunk "new", so a model switch re-embeds with no extra bookkeeping.
    const existing = await database.db
      .selectFrom('embeddingChunks')
      .where('notePath', '=', path)
      .select(['contentHash', 'modelId'])
      .execute()
    const available = new Map<string, number>()
    for (const row of existing) {
      const key = `${row.modelId} ${row.contentHash}`
      available.set(key, (available.get(key) ?? 0) + 1)
    }

    const skip = chunks.map((chunk) => {
      const key = `${modelId} ${chunk.contentHash}`
      const remaining = available.get(key) ?? 0
      if (remaining > 0) {
        available.set(key, remaining - 1)
        return true
      }
      return false
    })
    const toEmbed = chunks.filter((_, i) => !skip[i])
    const vectors =
      toEmbed.length > 0
        ? await embeddingRuntime.embedTexts(toEmbed.map((chunk) => chunk.text))
        : []
    let vectorAt = 0

    const payload: EmbedChunkPayload[] = chunks.map((chunk, i) => ({
      heading: chunk.heading,
      posFrom: chunk.posFrom,
      posTo: chunk.posTo,
      text: chunk.text,
      contentHash: chunk.contentHash,
      modelId,
      // A non-skipped chunk always has a freshly-embedded vector: `vectors` is
      // exactly as long as the non-skipped chunks, consumed in order here.
      vector: skip[i] ? null : vectors[vectorAt++]!,
    }))
    await applyChunks(path, payload, generation)
    return toEmbed.length
  }

  async function backfillNotes(
    options: EmbeddingBackfillOptions,
  ): Promise<'completed' | 'aborted'> {
    const { generation, modelId, onProgress, isStale } = options
    const rows = await database.db
      .selectFrom('notes')
      .where('kind', '!=', 'template')
      .select('path')
      .orderBy('path')
      .execute()
    let done = 0
    for (const row of rows) {
      if (isStale?.()) {
        return 'aborted'
      }
      try {
        await embedNote({ path: row.path, generation, modelId })
      } catch (cause) {
        logger.error(`embedding backfill failed for ${row.path}:`, cause)
      }
      done += 1
      onProgress?.(done, rows.length)
    }
    return 'completed'
  }

  async function backfill(options: EmbeddingBackfillOptions): Promise<EmbeddingBackfillResult> {
    try {
      return await backfillNotes(options)
    } catch {
      return 'failed'
    }
  }

  function follow(options: { generation: number; modelId: string }): Unlisten {
    const { generation, modelId } = options
    let active = true

    queue = queue
      .then(() => {
        if (!active) {
          return
        }
        return backfill({ generation, modelId, isStale: () => !active }).then(() => {})
      })
      .catch((cause: unknown) => {
        // A rejection here must not poison the queue (later change items
        // chain off this promise) nor masquerade as a per-change failure.
        logger.error('embedding backfill failed:', cause)
      })

    const unlisten = indexLifecycle.onChangesApplied((event) => {
      if (!active || event.generation !== generation) {
        return // torn down, or a delayed emit from a superseded index session
      }
      for (const change of event.changes) {
        if (!isNotePath(change.path)) {
          continue // asset-file changes ride the same batches — never embedded
        }
        queue = queue
          .then(() => {
            if (!active) {
              return
            }
            return change.kind === 'remove'
              ? removeNote(change.path, generation)
              : embedNote({ path: change.path, generation, modelId }).then(() => {})
          })
          .catch((cause: unknown) => {
            logger.error(`embedding sync failed for ${change.path}:`, cause)
          })
      }
    })

    return () => {
      active = false
      unlisten()
    }
  }

  return { embedNote, removeNote, backfill, follow }
}
