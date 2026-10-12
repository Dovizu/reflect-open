import type { IdService } from '../app/id-service.ts'
import { ReflectError } from '../errors.ts'
import type { AssetStoreService } from '../graph/asset-store-service.ts'
import {
  createNoteCreationService,
  type NoteCreationService,
  type ResolveOrCreateNoteResult,
} from '../graph/note-creation-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import {
  createNoteLinkResolverService,
  type ExistingWikiTargetResolution,
  type NoteLinkResolverService,
} from '../graph/note-link-resolver-service.ts'
import { ASSETS_DIR, AUDIO_MEMOS_DIR, isAttachmentPath, isNotePath } from '../graph/paths.ts'
import type { FileMeta } from '../graph/schemas.ts'
import {
  createWikiResolverService,
  type WikiResolverService,
} from '../indexing/wiki-resolver-service.ts'
import { bytesToBase64, base64ToBytes } from '../lib/base64.ts'
import { createTestDatabaseService } from './database.ts'
import { createTestIdService } from './id.ts'

function notFound(what: string): ReflectError {
  return new ReflectError('notFound', `${what} not found`)
}

function byteSize(contents: string): number {
  return new TextEncoder().encode(contents).length
}

/** Rejects a call pinned to a generation other than `current`, like Rust does. */
function checkGeneration(current: number | undefined, generation: number | undefined): void {
  if (current !== undefined && generation !== undefined && generation !== current) {
    throw new ReflectError('io', 'the graph changed since this command was issued; dropping it')
  }
}

export interface TestNoteFileServiceOptions {
  /** Graph-relative paths to file contents. */
  files?: Readonly<Record<string, string>>
  /** When set, calls pinned to another generation reject. */
  generation?: number
  /** Paths whose bytes are offloaded to iCloud. */
  evicted?: readonly string[]
}

export interface NoteFileWrite {
  path: string
  contents: string
  generation: number
}

export interface TestNoteFileService extends NoteFileService {
  /** Put a file into the graph without recording a write. */
  set(path: string, contents: string, options?: { modifiedMs?: number }): void
  /** Mark a path as offloaded to iCloud until it is written again. */
  evict(path: string): void
  /** The current files by graph-relative path. */
  files(): ReadonlyMap<string, string>
  /** Every successful `write` and `create`, in order. */
  writes(): readonly NoteFileWrite[]
  /** The contents of every successful `write` and `create` of `path`, in order. */
  getWrites(path: string): readonly string[]
  /** Every path moved to the trash, in order. */
  trashed(): readonly string[]
}

/**
 * An in-memory {@link NoteFileService}. Writes stamp `modifiedMs` from a
 * counter, so the n-th write in a test reports `n`; seeded files report 0.
 */
export function createTestNoteFileService(
  options?: TestNoteFileServiceOptions,
): TestNoteFileService {
  const files = new Map<string, { contents: string; modifiedMs: number }>()
  const evicted = new Set<string>(options?.evicted ?? [])
  const writeLog: NoteFileWrite[] = []
  const trashLog: string[] = []
  const generation = options?.generation
  let tick = 0

  for (const [path, contents] of Object.entries(options?.files ?? {})) {
    files.set(path, { contents, modifiedMs: 0 })
  }

  function store(path: string, contents: string, pinned: number): number {
    tick += 1
    files.set(path, { contents, modifiedMs: tick })
    evicted.delete(path)
    writeLog.push({ path, contents, generation: pinned })
    return tick
  }

  function contentsOf(path: string): string {
    const file = files.get(path)
    if (file === undefined) {
      throw notFound(path)
    }
    return file.contents
  }

  function list(include: (path: string) => boolean): FileMeta[] {
    return [...files]
      .filter(([path]) => include(path))
      .map(([path, file]) => ({
        path,
        size: byteSize(file.contents),
        modifiedMs: file.modifiedMs,
        ...(evicted.has(path) ? { placeholder: true } : {}),
      }))
  }

  return {
    async read(path, pinned) {
      checkGeneration(generation, pinned)
      return contentsOf(path)
    },
    async readLocal(path, pinned) {
      checkGeneration(generation, pinned)
      const content = contentsOf(path)
      return evicted.has(path) ? { kind: 'evicted' } : { kind: 'content', content }
    },
    async write(path, contents, pinned, expectedContents) {
      checkGeneration(generation, pinned)
      if (expectedContents !== undefined) {
        const current = files.get(path)?.contents ?? null
        if (current !== expectedContents) {
          throw new ReflectError('io', 'Note changed on disk; reload before retrying')
        }
      }
      return store(path, contents, pinned)
    },
    async create(path, contents, pinned) {
      checkGeneration(generation, pinned)
      if (files.has(path)) {
        return { kind: 'collision' }
      }
      return { kind: 'created', modifiedMs: store(path, contents, pinned) }
    },
    async exists(path) {
      return files.has(path)
    },
    async delete(path, pinned) {
      checkGeneration(generation, pinned)
      if (files.delete(path)) {
        evicted.delete(path)
        trashLog.push(path)
      }
    },
    async listNotes(pinned) {
      checkGeneration(generation, pinned)
      return list(isNotePath)
    },
    async listAttachments(pinned) {
      checkGeneration(generation, pinned)
      return list(isAttachmentPath)
    },
    async listDir(dir, pinned) {
      checkGeneration(generation, pinned)
      const prefix = dir.endsWith('/') ? dir : `${dir}/`
      return list((path) => path.startsWith(prefix))
    },
    async vaultScanStats(pinned) {
      checkGeneration(generation, pinned)
      return {
        notes: list(isNotePath).length,
        attachments: list(isAttachmentPath).length,
        skipped: 0,
      }
    },
    set(path, contents, setOptions) {
      files.set(path, { contents, modifiedMs: setOptions?.modifiedMs ?? 0 })
    },
    evict(path) {
      evicted.add(path)
    },
    files: () => new Map([...files].map(([path, file]) => [path, file.contents])),
    writes: () => [...writeLog],
    getWrites: (path) =>
      writeLog.filter((write) => write.path === path).map((write) => write.contents),
    trashed: () => [...trashLog],
  }
}

type Bytes = string | Uint8Array

function toBytes(contents: Bytes): Uint8Array<ArrayBuffer> {
  if (typeof contents === 'string') {
    return new TextEncoder().encode(contents)
  }
  const copy = new Uint8Array(contents.byteLength)
  copy.set(contents)
  return copy
}

export interface TestAssetStoreServiceOptions {
  /** Graph-relative paths to file bytes; strings are stored UTF-8 encoded. */
  assets?: Readonly<Record<string, Bytes>>
  /** OS paths that `importFile` and `importAudioMemo` can copy from. */
  sources?: Readonly<Record<string, Bytes>>
  /** Transcript cache entries by name. */
  transcripts?: Readonly<Record<string, string>>
  /** When set, calls pinned to another generation reject. */
  generation?: number
}

export interface AssetUpload {
  kind: 'blob' | 'path' | 'import' | 'base64' | 'audio-memo'
  path: string
  generation: number
}

export interface TestAssetStoreService extends AssetStoreService {
  /** The current files by graph-relative path. */
  assets(): ReadonlyMap<string, Uint8Array>
  /** Every successful write, in order. */
  uploads(): readonly AssetUpload[]
  /** The transcript cache by name. */
  transcripts(): ReadonlyMap<string, string>
  /** Every path passed to `open`, in order. */
  opened(): readonly string[]
  /** Every path passed to `reveal`, in order. */
  revealed(): readonly string[]
}

/**
 * An in-memory {@link AssetStoreService}. `uploadBlob` and `importFile` pick
 * `assets/<name>`, or the first free `-2`-suffixed variant.
 */
export function createTestAssetStoreService(
  options?: TestAssetStoreServiceOptions,
): TestAssetStoreService {
  const files = new Map<string, Uint8Array<ArrayBuffer>>()
  const sources = new Map<string, Uint8Array<ArrayBuffer>>()
  const transcripts = new Map<string, string>(Object.entries(options?.transcripts ?? {}))
  const uploadLog: AssetUpload[] = []
  const openLog: string[] = []
  const revealLog: string[] = []
  const generation = options?.generation

  for (const [path, contents] of Object.entries(options?.assets ?? {})) {
    files.set(path, toBytes(contents))
  }
  for (const [path, contents] of Object.entries(options?.sources ?? {})) {
    sources.set(path, toBytes(contents))
  }

  function freePath(desiredName: string): string {
    const dot = desiredName.lastIndexOf('.')
    const stem = dot > 0 ? desiredName.slice(0, dot) : desiredName
    const extension = dot > 0 ? desiredName.slice(dot) : ''
    let path = `${ASSETS_DIR}/${desiredName}`
    for (let suffix = 2; files.has(path); suffix++) {
      path = `${ASSETS_DIR}/${stem}-${suffix}${extension}`
    }
    return path
  }

  function store(
    kind: AssetUpload['kind'],
    path: string,
    bytes: Uint8Array<ArrayBuffer>,
    pinned: number,
  ): void {
    files.set(path, bytes)
    uploadLog.push({ kind, path, generation: pinned })
  }

  function bytesOf(path: string, from: ReadonlyMap<string, Uint8Array<ArrayBuffer>>) {
    const bytes = from.get(path)
    if (bytes === undefined) {
      throw notFound(path)
    }
    return bytes
  }

  async function blobBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await blob.arrayBuffer())
  }

  return {
    async uploadBlob(desiredName, contents, pinned) {
      checkGeneration(generation, pinned)
      const path = freePath(desiredName)
      store('blob', path, await blobBytes(contents), pinned)
      return path
    },
    async uploadToPath(path, contents, pinned) {
      checkGeneration(generation, pinned)
      store('path', path, await blobBytes(contents), pinned)
    },
    async importFile(sourcePath, desiredName, pinned) {
      checkGeneration(generation, pinned)
      const bytes = bytesOf(sourcePath, sources)
      const path = freePath(desiredName)
      store('import', path, bytes, pinned)
      return path
    },
    async writeBase64(path, contentsBase64, pinned) {
      checkGeneration(generation, pinned)
      store('base64', path, base64ToBytes(contentsBase64), pinned)
    },
    async readBase64(path, pinned) {
      checkGeneration(generation, pinned)
      return bytesToBase64(bytesOf(path, files))
    },
    async readBytes(path, pinned) {
      checkGeneration(generation, pinned)
      return toBytes(bytesOf(path, files))
    },
    async open(path, pinned) {
      checkGeneration(generation, pinned)
      openLog.push(path)
    },
    async reveal(path, pinned) {
      checkGeneration(generation, pinned)
      revealLog.push(path)
    },
    async deleteAudioMemo(path, pinned) {
      checkGeneration(generation, pinned)
      if (!path.startsWith(`${AUDIO_MEMOS_DIR}/`)) {
        throw new ReflectError('io', `not an audio memo: ${path}`)
      }
      files.delete(path)
    },
    async importAudioMemo(sourcePath, path, pinned) {
      checkGeneration(generation, pinned)
      if (files.has(path)) {
        return
      }
      store('audio-memo', path, bytesOf(sourcePath, sources), pinned)
    },
    async readTranscriptCache(name, pinned) {
      checkGeneration(generation, pinned)
      const contents = transcripts.get(name)
      if (contents === undefined) {
        throw notFound(name)
      }
      return contents
    },
    async writeTranscriptCache(name, contents, pinned) {
      checkGeneration(generation, pinned)
      transcripts.set(name, contents)
    },
    assets: () => new Map(files),
    uploads: () => [...uploadLog],
    transcripts: () => new Map(transcripts),
    opened: () => [...openLog],
    revealed: () => [...revealLog],
  }
}

export interface TestNoteLinkResolverServiceOptions {
  /** The index the resolver's tiers read; defaults to one over an empty test database. */
  wikiResolver?: WikiResolverService
  /** The files the resolver probes; defaults to an empty test note file service. */
  noteFile?: NoteFileService
}

/** One call to a {@link TestNoteLinkResolverService}, with its result. */
export type NoteLinkResolution =
  | {
      readonly kind: 'wiki'
      readonly target: string
      readonly generation: number
      readonly sourcePath: string | undefined
      readonly result: ExistingWikiTargetResolution
    }
  | {
      readonly kind: 'markdown'
      readonly sourcePath: string
      readonly href: string
      readonly generation: number
      readonly result: ExistingWikiTargetResolution
    }

export interface TestNoteLinkResolverService extends NoteLinkResolverService {
  /** Every settled resolution, in order. */
  calls(): readonly NoteLinkResolution[]
}

/** The real {@link NoteLinkResolverService} over test doubles, recording each resolution. */
export function createTestNoteLinkResolverService(
  options?: TestNoteLinkResolverServiceOptions,
): TestNoteLinkResolverService {
  const service = createNoteLinkResolverService({
    wikiResolver:
      options?.wikiResolver ?? createWikiResolverService({ database: createTestDatabaseService() }),
    noteFile: options?.noteFile ?? createTestNoteFileService(),
  })
  const log: NoteLinkResolution[] = []
  return {
    async resolveWikiTarget(target, generation, sourcePath) {
      const result = await service.resolveWikiTarget(target, generation, sourcePath)
      log.push({ kind: 'wiki', target, generation, sourcePath, result })
      return result
    },
    async resolveMarkdownHref(sourcePath, href, generation) {
      const result = await service.resolveMarkdownHref(sourcePath, href, generation)
      log.push({ kind: 'markdown', sourcePath, href, generation, result })
      return result
    },
    calls: () => [...log],
  }
}

export interface TestNoteCreationServiceOptions {
  /** Where notes are created; defaults to an empty test note file service. */
  noteFile?: NoteFileService
  /** Defaults to a {@link createTestNoteLinkResolverService} over `noteFile`. */
  noteLinkResolver?: NoteLinkResolverService
  /** Defaults to {@link createTestIdService}. */
  id?: IdService
}

export interface TestNoteCreationService extends NoteCreationService {
  /** Every path `createNoteWithTitle` or `resolveOrCreateNoteWithTitle` created, in order. */
  created(): readonly string[]
}

/** The real {@link NoteCreationService} over test doubles, recording each created path. */
export function createTestNoteCreationService(
  options?: TestNoteCreationServiceOptions,
): TestNoteCreationService {
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  const service = createNoteCreationService({
    noteFile,
    noteLinkResolver: options?.noteLinkResolver ?? createTestNoteLinkResolverService({ noteFile }),
    id: options?.id ?? createTestIdService(),
  })
  const createdLog: string[] = []
  return {
    ...service,
    async createNoteWithTitle(title, generation, body) {
      const path = await service.createNoteWithTitle(title, generation, body)
      createdLog.push(path)
      return path
    },
    async resolveOrCreateNoteWithTitle(
      title,
      generation,
      body,
    ): Promise<ResolveOrCreateNoteResult> {
      const result = await service.resolveOrCreateNoteWithTitle(title, generation, body)
      if (result.kind === 'created') {
        createdLog.push(result.path)
      }
      return result
    },
    created: () => [...createdLog],
  }
}
