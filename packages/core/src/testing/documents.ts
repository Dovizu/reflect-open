import type { ClipboardService } from '../app/clipboard-service.ts'
import type { ClockService } from '../app/clock-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { PathService } from '../app/path-service.ts'
import {
  createNoteActionsService,
  type NoteActionsService,
} from '../documents/note-actions-service.ts'
import {
  createNoteDocumentService,
  type NoteDocumentService,
} from '../documents/note-document-service.ts'
import {
  createNoteSessionService,
  frontmatterPatchToYaml,
  type NoteSession,
  type NoteSessionService,
} from '../documents/note-session.ts'
import {
  createOpenDocumentsService,
  type OpenDocumentsService,
} from '../documents/open-documents-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { IndexLifecycleService } from '../indexing/index-lifecycle-service.ts'
import { appendBlock } from '../markdown/append-section.ts'
import { upsertFrontmatter } from '../markdown/frontmatter.ts'
import { createTestClockService } from './clock.ts'
import { createTestNoteFileService } from './graph.ts'
import { createTestIdService } from './id.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'
import { createTestClipboardService, createTestPathService } from './shell.ts'

export interface TestNoteSessionOptions {
  /** Graph-relative path of the note. */
  path: string
  /** The full document (frontmatter + body). Defaults to empty. */
  content?: string
  /** False reports a session that is still loading: `liveContent()` is `null`. Defaults to true. */
  loaded?: boolean
  /** Defaults to false. */
  dirty?: boolean
  /** Defaults to false. */
  unpersisted?: boolean
  /**
   * False makes `updateFrontmatter`, `commitFrontmatter`, `commitSourceEdit`
   * and `commitBodyAppend` refuse. Defaults to true.
   */
  accepts?: boolean
}

export interface NoteSessionCall {
  method: keyof NoteSession
  args: readonly unknown[]
}

export interface TestNoteSession extends NoteSession {
  /** Every method call, in order. */
  calls(): readonly NoteSessionCall[]
  /** The arguments of every call of `method`, in order. */
  getCalls(method: keyof NoteSession): ReadonlyArray<readonly unknown[]>
}

/**
 * An in-memory {@link NoteSession} with no file behind it: the commit channels
 * edit `content` at once, and nothing loads, saves or reconciles.
 */
export function createTestNoteSession(options: TestNoteSessionOptions): TestNoteSession {
  let path = options.path
  let content = options.content ?? ''
  const loaded = options.loaded ?? true
  const accepts = options.accepts ?? true
  const callLog: NoteSessionCall[] = []

  const record = (method: keyof NoteSession, ...args: unknown[]): void => {
    callLog.push({ method, args })
  }

  return {
    get path() {
      return path
    },
    retarget: (to) => {
      record('retarget', to)
      path = to
    },
    load: () => {
      record('load')
    },
    editorChanged: (markdown) => {
      record('editorChanged', markdown)
    },
    externalChanged: () => {
      record('externalChanged')
    },
    flush: async () => {
      record('flush')
    },
    keepMine: () => {
      record('keepMine')
    },
    loadTheirs: () => {
      record('loadTheirs')
    },
    content: () => content,
    liveContent: () => (loaded ? content : null),
    isDirty: () => options.dirty ?? false,
    isUnpersisted: () => options.unpersisted ?? false,
    prepareDelete: async () => {
      record('prepareDelete')
      return options.unpersisted ?? false
    },
    cancelDelete: () => {
      record('cancelDelete')
    },
    updateFrontmatter: (patch) => {
      record('updateFrontmatter', patch)
      if (!accepts) {
        return false
      }
      content = upsertFrontmatter(content, frontmatterPatchToYaml(patch))
      return true
    },
    commitFrontmatter: async (patch) => {
      record('commitFrontmatter', patch)
      if (!accepts) {
        return false
      }
      content = upsertFrontmatter(content, frontmatterPatchToYaml(patch))
      return true
    },
    commitBodyAppend: async (block) => {
      record('commitBodyAppend', block)
      if (!accepts || block.trim() === '') {
        return false
      }
      content = appendBlock(content, block)
      return true
    },
    commitSourceEdit: async (transform) => {
      record('commitSourceEdit', transform)
      if (!accepts) {
        return false
      }
      content = transform(content)
      return true
    },
    dispose: () => {
      record('dispose')
    },
    discard: () => {
      record('discard')
    },
    calls: () => [...callLog],
    getCalls: (method) => callLog.filter((call) => call.method === method).map((call) => call.args),
  }
}

export interface TestNoteSessionServiceOptions {
  noteFile?: NoteFileService
  clock?: ClockService
  logger?: LoggerService
}

export interface TestNoteSessionService extends NoteSessionService {
  /** Every session created so far, in order. */
  sessions(): readonly NoteSession[]
}

/**
 * The real {@link NoteSessionService} over `noteFile`, `clock` and `logger`
 * (fresh test doubles by default).
 */
export function createTestNoteSessionService(
  options?: TestNoteSessionServiceOptions,
): TestNoteSessionService {
  const service = createNoteSessionService({
    noteFile: options?.noteFile ?? createTestNoteFileService(),
    clock: options?.clock ?? createTestClockService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
  const created: NoteSession[] = []
  return {
    create(sessionOptions) {
      const session = service.create(sessionOptions)
      created.push(session)
      return session
    },
    sessions: () => [...created],
  }
}

/** The real {@link OpenDocumentsService}, starting with `sessions` registered. */
export function createTestOpenDocumentsService(options?: {
  sessions?: readonly NoteSession[]
}): OpenDocumentsService {
  const service = createOpenDocumentsService()
  for (const session of options?.sessions ?? []) {
    service.register({ session })
  }
  return service
}

export interface TestNoteDocumentServiceOptions {
  /** Defaults to an empty {@link createTestOpenDocumentsService}. */
  openDocuments?: OpenDocumentsService
  /** Defaults to an empty {@link createTestNoteFileService}. */
  noteFile?: NoteFileService
}

/**
 * The real {@link NoteDocumentService} over `openDocuments` and `noteFile`
 * (fresh test doubles by default).
 */
export function createTestNoteDocumentService(
  options?: TestNoteDocumentServiceOptions,
): NoteDocumentService {
  return createNoteDocumentService({
    openDocuments: options?.openDocuments ?? createTestOpenDocumentsService(),
    noteFile: options?.noteFile ?? createTestNoteFileService(),
  })
}

export interface TestNoteActionsServiceOptions {
  /** Defaults to an empty {@link createTestNoteFileService}. */
  noteFile?: NoteFileService
  /** Defaults to an empty {@link createTestOpenDocumentsService}. */
  openDocuments?: OpenDocumentsService
  /** Defaults to the real service over `openDocuments` and `noteFile`. */
  noteDocuments?: NoteDocumentService
  /** Defaults to an indexer that only records its calls. */
  indexLifecycle?: Pick<IndexLifecycleService, 'indexNote'>
  operations?: OperationsService
  clipboard?: ClipboardService
  path?: PathService
  id?: IdService
}

export interface TestNoteActionsService extends NoteActionsService {
  /** Every note handed to the default indexer for an immediate reindex, in order. */
  indexed(): ReadonlyArray<{ path: string; generation: number }>
}

/**
 * The real {@link NoteActionsService} over test doubles (fresh ones by
 * default). The default indexer writes nothing.
 */
export function createTestNoteActionsService(
  options?: TestNoteActionsServiceOptions,
): TestNoteActionsService {
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  const openDocuments = options?.openDocuments ?? createTestOpenDocumentsService()
  const indexLog: { path: string; generation: number }[] = []
  const service = createNoteActionsService({
    noteDocuments: options?.noteDocuments ?? createNoteDocumentService({ openDocuments, noteFile }),
    noteFile,
    openDocuments,
    indexLifecycle: options?.indexLifecycle ?? {
      indexNote: async (path, indexOptions) => {
        indexLog.push({ path, generation: indexOptions.generation })
      },
    },
    operations: options?.operations ?? createTestOperationsService(),
    clipboard: options?.clipboard ?? createTestClipboardService(),
    path: options?.path ?? createTestPathService(),
    id: options?.id ?? createTestIdService(),
  })
  return { ...service, indexed: () => [...indexLog] }
}
