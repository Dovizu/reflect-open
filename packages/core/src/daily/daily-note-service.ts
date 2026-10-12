import { isNotNullish } from '@ocavue/utils'
import { defaultClock, type ClockService } from '../app/clock-service.ts'
import { defaultLifecycle, type AppLifecycleService } from '../app/lifecycle-service.ts'
import { defaultDatabase, type DatabaseService } from '../indexing/database-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import { localIsoDate } from '../lib/dates.ts'

/** One daily-note row of a date-ranged listing (the AI chat's daily tool). */
export interface DailyNoteRow {
  path: string
  title: string
  dailyDate: string
  /** The indexed row preview (`buildIndexedNote`; may be empty). */
  preview: string
  /** File modification time (epoch ms). */
  mtime: number
  isPrivate: boolean
}

export interface DailyNotesRange {
  /** First day, inclusive (ISO `YYYY-MM-DD`). */
  start: string
  /** Last day, inclusive (ISO `YYYY-MM-DD`). */
  end: string
  /** Row cap — the most recent days in range win. */
  limit: number
}

/**
 * The date questions about notes: today, which days have a daily note, and
 * the wake onto a new day. The window and grid arithmetic of the daily
 * surfaces is pure and lives next to this file (`day-window.ts`,
 * `week-window.ts`, `month-grid.ts`, `daily-arrivals.ts`).
 */
export interface DailyNoteService {
  /** Today's local calendar date as `YYYY-MM-DD` (the clock's live date). */
  today(): string
  /**
   * ISO dates within `[start, end]` (inclusive) whose daily note has content,
   * ascending: the calendar's day markers.
   */
  dailyDatesInRange(start: string, end: string): Promise<string[]>
  /**
   * Daily notes within `[start, end]` (inclusive), most recent first, capped at
   * `limit`. Daily files are created lazily on first write, so a row means the
   * day has real content. Private dailies are excluded in SQL so they don't
   * consume cap slots — the AI privacy gate still re-checks every row live.
   */
  listDailyNotes(range: DailyNotesRange): Promise<DailyNoteRow[]>
  /**
   * V1's wake-to-today: calls `listener` with the new date when the app
   * returns to the foreground on a later calendar date than it was last seen
   * on. An app left open across midnight rolls over through the clock's
   * `subscribeToday` instead, so this only reports the backgrounded case. The
   * caller navigates; this service does not.
   *
   * The date is read from the wall clock (`now()`) at each visibility change,
   * not from `today()`: the clock refreshes its cached date on the same
   * visibility event, and listener order must not decide the result.
   */
  subscribeWakeOnNewDay(listener: (today: string) => void): Unlisten
}

export function createDailyNoteService(deps: {
  database: DatabaseService
  clock: ClockService
  lifecycle: AppLifecycleService
}): DailyNoteService {
  const { clock, lifecycle } = deps
  const { db } = deps.database

  const wallDate = (): string => localIsoDate(new Date(clock.now()))

  return {
    today: () => clock.today(),

    async dailyDatesInRange(start, end) {
      const rows = await db
        .selectFrom('notes')
        .where('dailyDate', 'is not', null)
        .where('dailyDate', '>=', start)
        .where('dailyDate', '<=', end)
        .where('hasContent', '=', 1)
        .select('dailyDate')
        .orderBy('dailyDate')
        .execute()
      return rows.map((row) => row.dailyDate).filter(isNotNullish)
    },

    async listDailyNotes(range) {
      const rows = await db
        .selectFrom('notes')
        .where('dailyDate', 'is not', null)
        .where('dailyDate', '>=', range.start)
        .where('dailyDate', '<=', range.end)
        .where('isPrivate', '=', 0)
        .select(['path', 'title', 'dailyDate', 'preview', 'mtime', 'isPrivate'])
        .orderBy('dailyDate', 'desc')
        .limit(range.limit)
        .execute()
      return rows
        .flatMap((row) => {
          return row.dailyDate === null
            ? null
            : { ...row, dailyDate: row.dailyDate, isPrivate: row.isPrivate !== 0 }
        })
        .filter(isNotNullish)
    },

    subscribeWakeOnNewDay(listener) {
      let lastSeen = wallDate()
      const removeHidden = lifecycle.subscribeHidden(() => {
        lastSeen = wallDate()
      })
      const removeVisible = lifecycle.subscribeVisible(() => {
        const now = wallDate()
        if (now !== lastSeen) {
          lastSeen = now
          listener(now)
        }
      })
      return () => {
        removeHidden()
        removeVisible()
      }
    },
  }
}

let installedService: DailyNoteService | null = null
let fallback: {
  service: DailyNoteService
  database: DatabaseService
  clock: ClockService
  lifecycle: AppLifecycleService
} | null = null

/**
 * The process-wide `DailyNoteService`; one over {@link defaultDatabase},
 * {@link defaultClock} and {@link defaultLifecycle} unless
 * {@link setDefaultDailyNotes} installed another.
 */
export function defaultDailyNotes(): DailyNoteService {
  if (installedService !== null) {
    return installedService
  }
  const database = defaultDatabase()
  const clock = defaultClock()
  const lifecycle = defaultLifecycle()
  if (
    fallback?.database !== database ||
    fallback.clock !== clock ||
    fallback.lifecycle !== lifecycle
  ) {
    fallback = {
      service: createDailyNoteService({ database, clock, lifecycle }),
      database,
      clock,
      lifecycle,
    }
  }
  return fallback.service
}

/**
 * Install the process-wide `DailyNoteService`; `null` restores the one over
 * the default database, clock and lifecycle.
 */
export function setDefaultDailyNotes(service: DailyNoteService | null): void {
  installedService = service
}
