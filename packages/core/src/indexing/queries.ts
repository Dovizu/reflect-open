import { isNotNullish } from '@ocavue/utils'
import { db } from './db.ts'
import { defaultIndexQuery, type IndexQueryService } from './index-query-service.ts'
import { defaultIndexStore, type IndexStoreService } from './index-store-service.ts'
import { defaultWikiResolver, type WikiResolverService } from './wiki-resolver-service.ts'
export {
  getBacklinks,
  getBacklinksWithContext,
  type Backlink,
  type BacklinkContext,
  type BacklinkContextPage,
  type BacklinkContextPageOptions,
  type BacklinkSourceCursor,
} from './queries-backlinks.ts'
export {
  getWikiAddressForPath,
  suggestTags,
  suggestWikiLinkTargets,
  suggestWikiTargets,
  type TagSuggestion,
  type WikiLinkSuggestionResult,
} from './queries-suggestions.ts'
export type {
  ConflictedNote,
  DuplicateIdGroup,
  IndexedFileFacts,
  NoteRow,
  PinnedNote,
} from './index-query-service.ts'
export { UNCLAIMED_TIER, type WikiTargetMatch } from './wiki-resolver-service.ts'

/**
 * Index read getters (Plan 04). Queries are built with Kysely and execute over
 * the IPC bridge (`@reflect/db`). Rows are our own projection — trusted, not
 * re-validated per row (see Plan 04 §2).
 */

export const getPathLinkSources: WikiResolverService['getPathLinkSources'] = (...args) =>
  defaultWikiResolver().getPathLinkSources(...args)

export const getLinkSources: WikiResolverService['getLinkSources'] = (...args) =>
  defaultWikiResolver().getLinkSources(...args)

export const findWikiTargetMatch: WikiResolverService['findWikiTargetMatch'] = (...args) =>
  defaultWikiResolver().findWikiTargetMatch(...args)

export const findNotesByPathKey: WikiResolverService['findNotesByPathKey'] = (...args) =>
  defaultWikiResolver().findNotesByPathKey(...args)

export const resolveWikiTarget: WikiResolverService['resolveWikiTarget'] = (...args) =>
  defaultWikiResolver().resolveWikiTarget(...args)

export const getPinnedNotes: IndexQueryService['getPinnedNotes'] = (...args) =>
  defaultIndexQuery().getPinnedNotes(...args)

export const getNote: IndexQueryService['getNote'] = (...args) =>
  defaultIndexQuery().getNote(...args)

export const getConflictedNotes: IndexQueryService['getConflictedNotes'] = (...args) =>
  defaultIndexQuery().getConflictedNotes(...args)

export const getDuplicateNoteIds: IndexQueryService['getDuplicateNoteIds'] = (...args) =>
  defaultIndexQuery().getDuplicateNoteIds(...args)

export const getIndexMeta: IndexStoreService['getMeta'] = (...args) =>
  defaultIndexStore().getMeta(...args)

export const getIndexedFileFactsByPath: IndexQueryService['getIndexedFileFactsByPath'] = (
  ...args
) => defaultIndexQuery().getIndexedFileFactsByPath(...args)

export const getNoteIdsByPath: IndexQueryService['getNoteIdsByPath'] = (...args) =>
  defaultIndexQuery().getNoteIdsByPath(...args)

/**
 * ISO dates within `[start, end]` (inclusive) whose daily note has content,
 * ascending: the calendar's day markers.
 */
export async function dailyDatesInRange(start: string, end: string): Promise<string[]> {
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
}

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
 * Daily notes within `[start, end]` (inclusive), most recent first, capped at
 * `limit`. Daily files are created lazily on first write, so a row means the
 * day has real content. Private dailies are excluded in SQL so they don't
 * consume cap slots — the AI privacy gate still re-checks every row live.
 */
export async function listDailyNotes(range: DailyNotesRange): Promise<DailyNoteRow[]> {
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
}
