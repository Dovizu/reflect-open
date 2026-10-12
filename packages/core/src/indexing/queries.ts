import { defaultDailyNotes, type DailyNoteService } from '../daily/daily-note-service.ts'
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
  compareTasksByNote,
  getCompletedTasks,
  getOpenTasks,
  type OpenTask,
} from './queries-tasks.ts'
export {
  getWikiAddressForPath,
  suggestTags,
  suggestWikiLinkTargets,
  suggestWikiTargets,
  type TagSuggestion,
  type WikiLinkSuggestionResult,
} from './queries-suggestions.ts'
export type { DailyNoteRow, DailyNotesRange } from '../daily/daily-note-service.ts'
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

export const dailyDatesInRange: DailyNoteService['dailyDatesInRange'] = (...args) =>
  defaultDailyNotes().dailyDatesInRange(...args)

export const listDailyNotes: DailyNoteService['listDailyNotes'] = (...args) =>
  defaultDailyNotes().listDailyNotes(...args)
