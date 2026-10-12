import { z } from 'zod'
import type { ClockService } from '../app/clock-service.ts'
import type { FileChangeService } from '../indexing/file-change-service.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'
import {
  fileMetaSchema,
  noteCreateOutcomeSchema,
  type FileMeta,
  type NoteCreateOutcome,
} from './schemas.ts'

/** Commands that return `()` from Rust serialize as `null` over IPC. */
const voidSchema = z.null()

const localNoteReadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('content'), content: z.string() }),
  z.object({ kind: z.literal('evicted') }),
])

/** How a {@link NoteFileService.readLocal} request found the note on disk. */
export type LocalNoteRead = z.infer<typeof localNoteReadSchema>

const vaultScanStatsSchema = z.object({
  notes: z.number(),
  attachments: z.number(),
  skipped: z.number(),
})

export type VaultScanStats = z.infer<typeof vaultScanStatsSchema>

/**
 * Markdown notes by graph-relative path. Every write, create and delete is
 * reported to {@link FileChangeService.reportOwnWrite} after it lands.
 */
export interface NoteFileService {
  /**
   * A note's markdown. `generation`, when given, pins the read to the issuing
   * graph session; reads that can span a graph switch must pin it.
   */
  read(path: string, generation?: number): Promise<string>
  /**
   * A note's markdown only when its bytes are local: an iCloud-evicted note
   * reports `evicted` instead of being downloaded. A missing file still
   * rejects with `notFound`.
   */
  readLocal(path: string, generation?: number): Promise<LocalNoteRead>
  /**
   * Write a note atomically, pinned to `generation`. `expectedContents`
   * rejects a stale source revision (`null` requires a missing file);
   * omitting it writes unconditionally. Resolves with the on-disk mtime,
   * or the clock's time when the platform reports none.
   */
  write(
    path: string,
    contents: string,
    generation: number,
    expectedContents?: string | null,
  ): Promise<number>
  /** Create a note only when `path` is free. A collision is returned, never overwritten. */
  create(path: string, contents: string, generation: number): Promise<NoteCreateOutcome>
  /** Whether a file exists at `path` on disk right now. */
  exists(path: string): Promise<boolean>
  /** Move a note to the OS trash (`.reflect/trash/` on mobile). */
  delete(path: string, generation: number): Promise<void>
  /** Every eligible Markdown note in the graph. */
  listNotes(generation?: number): Promise<FileMeta[]>
  /** Every supported local attachment in the graph. */
  listAttachments(generation?: number): Promise<FileMeta[]>
  /** Every file under a graph-relative directory. A missing directory lists as empty. */
  listDir(dir: string, generation: number): Promise<FileMeta[]>
  /** Counts from the vault catalog, including what the walk skipped. */
  vaultScanStats(generation?: number): Promise<VaultScanStats>
}

export function createNoteFileService(deps: {
  ipc: IpcBridgeService
  clock: ClockService
  fileChanges: FileChangeService
}): NoteFileService {
  const { ipc, clock, fileChanges } = deps
  return {
    async read(path, generation) {
      return await ipc.call('note_read', { path, generation }, z.string())
    },
    async readLocal(path, generation) {
      return await ipc.call('note_read_local', { path, generation }, localNoteReadSchema)
    },
    async write(path, contents, generation, expectedContents) {
      const diskMs = await ipc.call(
        'note_write',
        {
          path,
          contents,
          generation,
          ...(expectedContents === undefined ? {} : { checkContents: true, expectedContents }),
        },
        z.number().nullable(),
      )
      const modifiedMs = diskMs ?? clock.now()
      fileChanges.reportOwnWrite([{ path, kind: 'upsert', modifiedMs }])
      return modifiedMs
    },
    async create(path, contents, generation) {
      const outcome = await ipc.call(
        'note_create',
        { path, contents, generation },
        noteCreateOutcomeSchema,
      )
      if (outcome.kind === 'created') {
        fileChanges.reportOwnWrite([
          { path, kind: 'upsert', modifiedMs: outcome.modifiedMs ?? clock.now() },
        ])
      }
      return outcome
    },
    async exists(path) {
      return await ipc.call('note_exists', { path }, z.boolean())
    },
    async delete(path, generation) {
      await ipc.call('note_delete', { path, generation }, voidSchema)
      fileChanges.reportOwnWrite([{ path, kind: 'remove' }])
    },
    async listNotes(generation) {
      return await ipc.call('list_files', { generation }, z.array(fileMetaSchema))
    },
    async listAttachments(generation) {
      return await ipc.call('list_attachments', { generation }, z.array(fileMetaSchema))
    },
    async listDir(dir, generation) {
      return await ipc.call('dir_list', { dir, generation }, z.array(fileMetaSchema))
    },
    async vaultScanStats(generation) {
      return await ipc.call('vault_scan_stats', { generation }, vaultScanStatsSchema)
    },
  }
}
