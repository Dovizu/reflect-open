import type { ClockService } from '../app/clock-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { NoteDocumentService } from '../documents/note-document-service.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import { renderInlineText } from '../markdown/index.ts'
import type { OpenTask } from '../tasks/open-task.ts'
import { createTaskService, type TaskService } from '../tasks/task-service.ts'
import { createTestClockService } from './clock.ts'
import { createTestDatabaseService } from './database.ts'
import { createTestNoteDocumentService } from './documents.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'

/**
 * An open-task row with sensible defaults for tests; override only what a
 * case needs. `text` tracks `markdown` unless a case pins it explicitly.
 */
export function makeOpenTask(overrides: Partial<OpenTask> = {}): OpenTask {
  const markdown = overrides.markdown ?? overrides.text ?? 'do it'
  return {
    notePath: 'notes/n.md',
    astPath: [0],
    markdown,
    checked: false,
    text: renderInlineText(markdown),
    breadcrumbs: [],
    noteTitle: 'N',
    dueDate: null,
    dailyDate: null,
    isPinned: false,
    pinnedOrder: null,
    updatedAt: 0,
    ...overrides,
  }
}

export interface TestTaskServiceOptions {
  /** Defaults to an empty {@link createTestDatabaseService}. */
  database?: DatabaseService
  /** Defaults to an empty {@link createTestNoteDocumentService}. */
  noteDocuments?: NoteDocumentService
  /** Defaults to a fresh {@link createTestOperationsService}. */
  operations?: OperationsService
  /** Defaults to a fresh {@link createTestClockService}. */
  clock?: ClockService
  /** Defaults to a fresh {@link createTestLoggerService}. */
  logger?: LoggerService
}

/** The real {@link TaskService} over fresh test doubles by default. */
export function createTestTaskService(options?: TestTaskServiceOptions): TaskService {
  return createTaskService({
    database: options?.database ?? createTestDatabaseService(),
    noteDocuments: options?.noteDocuments ?? createTestNoteDocumentService(),
    operations: options?.operations ?? createTestOperationsService(),
    clock: options?.clock ?? createTestClockService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}
