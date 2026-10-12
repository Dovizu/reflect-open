import type { ClockService } from '../app/clock-service.ts'
import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import { createDailyNoteService, type DailyNoteService } from '../daily/daily-note-service.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import { createTestClockService } from './clock.ts'
import { createTestDatabaseService } from './database.ts'
import { createTestLifecycleService } from './shell.ts'

export interface TestDailyNoteServiceOptions {
  /** Defaults to an empty {@link createTestDatabaseService}. */
  database?: DatabaseService
  /** Defaults to a fresh {@link createTestClockService}. */
  clock?: ClockService
  /** Defaults to a fresh {@link createTestLifecycleService}. */
  lifecycle?: AppLifecycleService
}

/**
 * The real {@link DailyNoteService} over `database`, `clock` and `lifecycle`
 * (fresh test doubles by default). Wake detection reads `clock.now()`, so move
 * it with `setNow`, not `setToday`.
 */
export function createTestDailyNoteService(
  options?: TestDailyNoteServiceOptions,
): DailyNoteService {
  return createDailyNoteService({
    database: options?.database ?? createTestDatabaseService(),
    clock: options?.clock ?? createTestClockService(),
    lifecycle: options?.lifecycle ?? createTestLifecycleService(),
  })
}
