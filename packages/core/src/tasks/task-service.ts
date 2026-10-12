import type { ClockService } from '../app/clock-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import { NoteBusyError, type NoteDocumentService } from '../documents/note-document-service.ts'
import { errorMessage } from '../errors.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import { decodeTaskBreadcrumbs } from '../indexing/indexed-note.ts'
import type { SnippetTask } from '../indexing/snippet-tasks.ts'
import {
  applyTaskEdits,
  decodeTaskPath,
  renderTaskSnapshot,
  type TaskEdit,
  type TaskEditResult,
  type TaskLocator,
  type TaskSnapshot,
} from '../markdown/index.ts'
import { compareTasksByNote, type OpenTask } from './open-task.ts'
import { withChecked, withRelocatedTasks, type TaskMoves } from './task-cache.ts'
import { getTaskKey } from './task-identity.ts'

/** A task's locator ({@link TaskLocator}) plus the note it lives in. */
export interface TaskRef extends TaskLocator {
  notePath: string
}

/** A task write's {@link TaskEditResult} plus when the write landed. */
export interface TaskWriteResult extends TaskEditResult {
  /** Epoch milliseconds read right after the write, for optimistic rows. */
  readonly updatedAt: number
}

/** A write that added one task: the new row's address and where the note's other tasks went. */
export interface InsertedTask {
  /** The new empty task, as the written note addresses it. */
  readonly created: TaskSnapshot
  /** Where every pre-existing task of the note ended up after the write. */
  readonly moved: TaskEditResult['moved']
  /** Epoch milliseconds read right after the write, for the optimistic row. */
  readonly updatedAt: number
}

export interface WriteTaskEditsOptions {
  /** Treat a missing note as empty: the first task creates it (today's daily). */
  readonly createIfMissing?: boolean
}

/** One change to the task `writeTask` addresses; `writeTask` supplies the locator. */
export type TaskAction =
  | { kind: 'toggle' }
  | { kind: 'setMarkdown'; markdown: string }
  | { kind: 'remove' }
  | { kind: 'toBullet' }

/** A click on the `index`th checkbox of a rendered snippet, as the view reports it. */
export interface SnippetTaskClick {
  index: number
  checked: boolean
  text: string
}

/**
 * Reads, edits and adds round-checkbox tasks across notes (Plan 18), plus the
 * session's "recently completed" set.
 *
 * The recently-completed set is V1's middle state where a checked task keeps
 * showing (struck) in the list until you archive it. It's deliberately a
 * **view-only, ephemeral** set, not durable state: a checked task is already
 * `[x]` on disk, and "archived" only means "stop showing it in the active
 * list", which the markdown can't (and shouldn't) encode. So it resets on app
 * restart; it survives navigating away from Tasks and back (it lives on the
 * service, above any one screen mount). Tracking the session's completions —
 * rather than every `[x]` task — is what keeps a fresh launch clean: only what
 * you checked *this run* lingers struck; the whole historical pile stays
 * behind the "show archived" filter. It is scoped to a graph root: switching
 * graphs (whose task paths differ) yields an empty set rather than the
 * previous graph's rows.
 */
export interface TaskService {
  /**
   * Every open task across the graph, with note context, for the Tasks view.
   * Private notes' tasks are included because this is a local-only surface.
   */
  getOpenTasks(): Promise<OpenTask[]>
  /**
   * Completed tasks across the graph, most-recently-edited note first — the
   * Tasks view's "show archived" surface.
   */
  getCompletedTasks(): Promise<OpenTask[]>
  /**
   * Apply Tasks-view edits to one note and persist them through
   * `NoteDocumentService.commitSourceEdit`: the live session when the note is
   * open (a session that can't persist now surfaces as `NoteBusyError`), else
   * disk, serialized per note. Every locator in `edits` describes the note as
   * the index last saw it; one whose task is gone surfaces as `TaskStaleError`
   * from the core edit rather than a silent wrong write. The result reports
   * where every task of the note ended up, so callers can re-address cached
   * rows before the reindex.
   */
  writeTaskEdits(
    notePath: string,
    edits: readonly TaskEdit[],
    generation: number,
    options?: WriteTaskEditsOptions,
  ): Promise<TaskWriteResult>
  /**
   * Apply `actions` to one task in one write: toggle its checkbox, replace its
   * Markdown (the first paragraph without the marker), remove it (nested items
   * move up), or demote it to a plain bullet so it leaves the Tasks projection
   * but stays in the note. Several actions land together, so an inline edit
   * and the toggle or convert that ends it are one write; every action
   * addresses the task as the index knew it.
   */
  writeTask(
    task: TaskRef,
    actions: readonly TaskAction[],
    generation: number,
  ): Promise<TaskWriteResult>
  /**
   * Write `tasks` one at a time through {@link TaskService.writeTask}. Tasks
   * can share a note, and a removal moves the items below it, so after each
   * write `onWritten` runs and the rest of the batch is re-addressed from the
   * write's `moved` map before its own write. Rejects at the first failed
   * write; the earlier ones have landed.
   */
  writeTasks(
    tasks: readonly OpenTask[],
    actionsFor: (task: OpenTask) => readonly TaskAction[],
    generation: number,
    onWritten?: (task: OpenTask, result: TaskWriteResult) => void,
  ): Promise<void>
  /**
   * Continue entry from a grouped task: resolve the current draft and add a new
   * empty task at the end of the same parent item, or of the task's own list
   * under a heading, in one write. Changed content replaces the anchor's
   * Markdown; cleared content removes the anchor. The result addresses the new
   * row and every moved row in the written note, so the Tasks view can select
   * the new task and re-key cached rows before reindexing catches up.
   */
  continueTaskInContext(
    task: TaskRef,
    content: string | null,
    generation: number,
  ): Promise<InsertedTask>
  /**
   * Insert a new empty `+ [ ]` task into `notePath`'s `## Tasks` section
   * (Return-to-add), creating the section after the note's last content when
   * it has none, and return the new row's address plus where the note's other
   * tasks moved. A missing note (today's daily not yet created) starts empty.
   */
  insertTask(notePath: string, generation: number): Promise<InsertedTask>
  /**
   * The clicked snippet checkbox against the anchor for the same index. The
   * view and the anchors enumerate the same markdown independently (the
   * render walk vs the core's parse — see `extractSnippetTasks`), so index,
   * state, and the item's own first-line text must all agree; any mismatch
   * means the two walks drifted, and a toggle would hit the wrong task. A
   * drift is reported as a failed operation and answers `null`.
   */
  resolveSnippetTask(tasks: readonly SnippetTask[], click: SnippetTaskClick): SnippetTask | null
  /**
   * Write a backlink-snippet checkbox click through to the source note: one
   * {@link TaskService.writeTask} toggle of `locator`. A failed write is
   * reported as a failed operation, then rethrown.
   */
  toggleSnippetTask(
    notePath: string,
    task: { locator: TaskLocator; checked: boolean },
    generation: number,
  ): Promise<void>
  /**
   * Keep `completed` showing struck (checked) in the active list until archived.
   * Stored as a fresh checked copy, deduped by {@link getTaskKey}. `checked` is
   * set to match disk: these rows outlive the reindex, and the write-back guards
   * on it, so a stale `false` would later fail a reopen/edit/delete.
   */
  markRecentlyCompleted(root: string | null, completed: readonly OpenTask[]): void
  /** Drop these keys — a completion rolled back, or the task was deleted. */
  forgetRecentlyCompleted(root: string | null, keys: readonly string[]): void
  /** Whether a task is currently being kept visible by the session's struck set. */
  hasRecentlyCompleted(root: string | null, key: string): boolean
  /**
   * Apply a note write's task moves to the session's struck rows. Unlike the
   * query caches, this set is not rebuilt by an open-task refetch, so moved
   * completed rows must be re-keyed explicitly.
   */
  relocateRecentlyCompleted(root: string | null, notePath: string, moved: TaskMoves): void
  /**
   * Reconcile the struck set against a fresh open-tasks read, dropping every
   * struck copy whose task was reopened at its source note ({@link
   * withoutReopenedTasks}) — so `hasRecentlyCompleted` and the Archive count
   * agree with what the surfaces render.
   */
  reconcileRecentlyCompleted(root: string | null, open: readonly OpenTask[]): void
  /** Archive: stop showing the session's completed tasks (they stay `[x]` on disk). */
  archiveRecentlyCompleted(root: string | null): void
  /** The session's struck rows for `root`; a stable empty list for any other graph. */
  getRecentlyCompleted(root: string | null): readonly OpenTask[]
  /** Calls `listener` whenever the recently-completed set changes. */
  subscribeRecentlyCompleted: (listener: () => void) => () => void
}

/**
 * The struck rows not superseded by a live open row — the pure core of the
 * reconciliation, shared by the store prune
 * ({@link TaskService.reconcileRecentlyCompleted}) and the render-time view.
 * A struck task the index reports open again with a **newer** `updatedAt` was
 * reopened at the source note — its file was rewritten and reindexed since we
 * completed it — so the struck copy is dropped and the live open row shows
 * instead of a stale `[x]` shadow (whose reopen write-back would fail: the
 * `[x]` line is no longer in the note). An open row with an *unchanged*
 * `updatedAt` is the pre-completion index state — a refetch racing the
 * completion's reindex — and keeps its shadow, so a just-checked row can't
 * flicker back to open. Returns the input array itself when nothing is
 * dropped, so callers can compare by reference.
 */
export function withoutReopenedTasks(
  struck: readonly OpenTask[],
  open: readonly OpenTask[],
): readonly OpenTask[] {
  if (struck.length === 0 || open.length === 0) {
    return struck
  }
  const liveByKey = new Map(open.map((row) => [getTaskKey(row), row]))
  const next = struck.filter((task) => {
    const live = liveByKey.get(getTaskKey(task))
    return live === undefined || live.updatedAt <= task.updatedAt
  })
  return next.length === struck.length ? struck : next
}

interface TaskRecord {
  notePath: string
  astPath: string
  markdown: string
  breadcrumbs: string
  checked: number
  noteTitle: string
  dailyDate: string | null
  isPinned: number
  pinnedOrder: number | null
  updatedAt: number
}

/** Only the locator goes to the core edit: the note path merely picks the owner. */
function toLocator(task: TaskRef): TaskLocator {
  return { astPath: task.astPath, markdown: task.markdown, checked: task.checked }
}

function requireInserted(result: TaskEditResult): TaskSnapshot {
  const created = result.inserted[0]
  if (created === undefined) {
    throw new Error('The new task was not written.')
  }
  return created
}

const EMPTY: readonly OpenTask[] = []

export function createTaskService(deps: {
  database: DatabaseService
  noteDocuments: Pick<NoteDocumentService, 'commitSourceEdit'>
  operations: Pick<OperationsService, 'start'>
  clock: Pick<ClockService, 'now'>
  logger: Pick<LoggerService, 'error' | 'warn'>
}): TaskService {
  const { noteDocuments, operations, clock, logger } = deps
  const { db } = deps.database

  function taskRowsQuery() {
    return db
      .selectFrom('tasks')
      .innerJoin('notes', 'notes.path', 'tasks.notePath')
      .where('notes.kind', '!=', 'template')
      .select([
        'tasks.notePath',
        'tasks.astPath',
        'tasks.markdown',
        'tasks.breadcrumbs',
        'tasks.checked',
        'notes.title as noteTitle',
        'notes.dailyDate',
        'notes.isPinned',
        'notes.pinnedOrder',
        'notes.updatedAt',
      ])
  }

  /**
   * Map stored rows to their domain shape. A row whose address or breadcrumbs
   * do not decode is skipped and reported instead of failing the whole read: the
   * projection is rebuilt from Markdown, so such a row is a bug, not data.
   */
  function toTaskRows(rows: readonly TaskRecord[]): OpenTask[] {
    const tasks: OpenTask[] = []
    for (const row of rows) {
      const { astPath, markdown, breadcrumbs, checked, isPinned, ...rest } = row
      try {
        tasks.push({
          ...rest,
          ...renderTaskSnapshot({
            astPath: decodeTaskPath(astPath),
            markdown,
            breadcrumbs: decodeTaskBreadcrumbs(breadcrumbs),
            checked: checked !== 0,
          }),
          isPinned: isPinned !== 0,
        })
      } catch (cause) {
        logger.error(`tasks: skipping an unreadable row in ${row.notePath} (${astPath})`, cause)
      }
    }
    return tasks
  }

  let graphRoot: string | null = null
  let struck: readonly OpenTask[] = EMPTY
  const listeners = new Set<() => void>()

  function emit(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  /** Switch the active graph, discarding any other graph's set. */
  function adopt(root: string | null): void {
    if (root !== graphRoot) {
      graphRoot = root
      struck = EMPTY
    }
  }

  const service: TaskService = {
    async getOpenTasks() {
      const rows = await taskRowsQuery().where('tasks.checked', '=', 0).execute()
      return toTaskRows(rows).sort(compareTasksByNote)
    },
    async getCompletedTasks() {
      const rows = await taskRowsQuery().where('tasks.checked', '=', 1).execute()
      return toTaskRows(rows).sort(
        (left, right) => right.updatedAt - left.updatedAt || compareTasksByNote(left, right),
      )
    },
    async writeTaskEdits(notePath, edits, generation, options = {}) {
      let result: TaskEditResult | undefined
      await noteDocuments.commitSourceEdit(
        notePath,
        (source) => {
          result = applyTaskEdits({ logger }, source, edits)
          return result.source
        },
        { generation, createIfMissing: options.createIfMissing === true },
      )
      if (result === undefined) {
        throw new NoteBusyError('This note can’t be updated right now — try again in a moment.')
      }
      return { ...result, updatedAt: clock.now() }
    },
    writeTask(task, actions, generation) {
      const locator = toLocator(task)
      return service.writeTaskEdits(
        task.notePath,
        actions.map((action) => ({ ...action, task: locator })),
        generation,
      )
    },
    async writeTasks(tasks, actionsFor, generation, onWritten) {
      let pending: readonly OpenTask[] = tasks
      for (let task = pending[0]; task !== undefined; task = pending[0]) {
        const result = await service.writeTask(task, actionsFor(task), generation)
        onWritten?.(task, result)
        const rest: readonly OpenTask[] = pending.slice(1)
        pending = withRelocatedTasks({ logger }, rest, task.notePath, result.moved)
      }
    },
    async continueTaskInContext(task, content, generation) {
      const locator = toLocator(task)
      const edits: TaskEdit[] = [
        { kind: 'insert', at: { kind: 'contextEnd', task: locator }, markdown: '' },
      ]
      if (content === '') {
        edits.push({ kind: 'remove', task: locator })
      } else if (content !== null) {
        edits.push({ kind: 'setMarkdown', task: locator, markdown: content })
      }
      const result = await service.writeTaskEdits(task.notePath, edits, generation)
      return {
        created: requireInserted(result),
        moved: result.moved,
        updatedAt: result.updatedAt,
      }
    },
    async insertTask(notePath, generation) {
      const result = await service.writeTaskEdits(
        notePath,
        [{ kind: 'insert', at: { kind: 'tasksSection' }, markdown: '' }],
        generation,
        { createIfMissing: true },
      )
      return {
        created: requireInserted(result),
        moved: result.moved,
        updatedAt: result.updatedAt,
      }
    },
    resolveSnippetTask(tasks, click) {
      const anchor = tasks[click.index]
      if (anchor === undefined || anchor.checked !== click.checked || anchor.text !== click.text) {
        operations.start('Updating task').fail('The note has changed — try again in a moment.')
        return null
      }
      return anchor
    },
    async toggleSnippetTask(notePath, task, generation) {
      try {
        await service.writeTask({ notePath, ...task.locator }, [{ kind: 'toggle' }], generation)
      } catch (cause) {
        operations
          .start(task.checked ? 'Reopening task' : 'Completing task')
          .fail(errorMessage(cause))
        throw cause
      }
    },
    markRecentlyCompleted(root, completed) {
      if (completed.length === 0) {
        return
      }
      adopt(root)
      const byKey = new Map(struck.map((task) => [getTaskKey(task), task]))
      for (const task of completed) {
        byKey.set(getTaskKey(task), withChecked(task, true))
      }
      struck = [...byKey.values()]
      emit()
    },
    forgetRecentlyCompleted(root, keys) {
      if (root !== graphRoot || keys.length === 0) {
        return
      }
      const drop = new Set(keys)
      const next = struck.filter((task) => !drop.has(getTaskKey(task)))
      if (next.length !== struck.length) {
        struck = next
        emit()
      }
    },
    hasRecentlyCompleted(root, key) {
      return root === graphRoot && struck.some((task) => getTaskKey(task) === key)
    },
    relocateRecentlyCompleted(root, notePath, moved) {
      if (root !== graphRoot || moved.length === 0) {
        return
      }
      const next = withRelocatedTasks({ logger }, struck, notePath, moved)
      if (next !== struck) {
        struck = next
        emit()
      }
    },
    reconcileRecentlyCompleted(root, open) {
      if (root !== graphRoot) {
        return
      }
      const next = withoutReopenedTasks(struck, open)
      if (next !== struck) {
        struck = next
        emit()
      }
    },
    archiveRecentlyCompleted(root) {
      adopt(root)
      if (struck.length > 0) {
        struck = EMPTY
        emit()
      }
    },
    getRecentlyCompleted(root) {
      return root === graphRoot ? struck : EMPTY
    },
    subscribeRecentlyCompleted(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return service
}
