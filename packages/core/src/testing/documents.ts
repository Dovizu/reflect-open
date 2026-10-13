import {
  createNoteMoveService,
  type NoteMoveService,
  type NoteMoveServiceDeps,
} from '../documents/note-move-service.ts'
import { frontmatterPatchToYaml, type NoteSession } from '../documents/note-session.ts'
import { appendBlock } from '../markdown/append-section.ts'
import { upsertFrontmatter } from '../markdown/frontmatter.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestIndexStoreService } from './index-store.ts'
import { createTestIpcBridgeService } from './ipc.ts'
import { createOpenDocumentsService } from '../documents/open-documents-service.ts'
import { createTestFileChangeService } from './file-change.ts'

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

export interface TestNoteMoveService extends NoteMoveService {
  /** Every move announced to the subscribers, in order. */
  moved(): ReadonlyArray<readonly [from: string, to: string]>
}

/**
 * The real {@link NoteMoveService} over `ipc`, `indexStore`, `openDocuments`
 * and `logger` (fresh test doubles by default).
 */
export function createTestNoteMoveService(
  options?: Partial<NoteMoveServiceDeps>,
): TestNoteMoveService {
  const service = createNoteMoveService({
    ipc: options?.ipc ?? createTestIpcBridgeService(),
    indexStore: options?.indexStore ?? createTestIndexStoreService(),
    openDocuments:
      options?.openDocuments ??
      createOpenDocumentsService({ fileChanges: createTestFileChangeService() }),
    logger: options?.logger ?? createTestLoggerService(),
  })
  const moves: Array<readonly [string, string]> = []
  service.onMoved((from, to) => {
    moves.push([from, to])
  })
  return {
    ...service,
    moved: () => [...moves],
  }
}
