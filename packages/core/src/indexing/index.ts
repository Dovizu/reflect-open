/**
 * `@reflect/core` indexing layer (Plan 04) — the TS pipeline that turns parsed
 * notes into the SQLite projection, plus the typed read getters over it.
 */
export {
  applyIndexedNote,
  applyIndexedNotes,
  removeFromIndex,
  moveNoteIndexed,
  clearIndex,
  setIndexMeta,
} from './commands.ts'
export {
  subscribeFileChanges,
  subscribeReconcileRequests,
  emitFileChanges,
  type FileChangeHandler,
} from './file-changes.ts'
export {
  FILE_CHANGES_EVENT,
  RECONCILE_EVENT,
  type FileChange,
  type FileChangeSource,
} from './file-change-service.ts'
export { subscribeOwnWrites } from './local-write-echo.ts'
export { subscribeIcloudConflicts, subscribeIcloudWatchFailed } from './icloud-conflicts.ts'
export { INDEX_WRITTEN_EVENT, subscribeIndexWritten } from './index-written.ts'
export { applyIndexChanges, type ApplyErrorHandler, type MovedHandler } from './live.ts'
export { hashContent } from './hash.ts'
export { availableTemplatePath, slugPathForTitle, templateSlugPathForTitle } from './note-paths.ts'
export { listTemplates, type TemplateEntry } from './template-list.ts'
export {
  buildIndexedNote,
  CLAIM_TIER,
  decodeTaskBreadcrumbs,
  encodeTaskBreadcrumbs,
  indexedNoteSchema,
  indexedLinkSchema,
  indexedTagSchema,
  indexedAliasSchema,
  PROJECTION_VERSION,
  type IndexedNote,
  type IndexedLink,
  type IndexedTag,
  type IndexedAlias,
} from './indexed-note.ts'
export { indexNote, PROJECTION_VERSION_KEY, type IndexPassOptions } from './indexer.ts'
export {
  dailyDatesInRange,
  getBacklinks,
  getBacklinksWithContext,
  getConflictedNotes,
  getDuplicateNoteIds,
  getIndexMeta,
  getLinkSources,
  getPathLinkSources,
  getNote,
  getPinnedNotes,
  getWikiAddressForPath,
  suggestWikiTargets,
  suggestWikiLinkTargets,
  suggestTags,
  getIndexedFileFactsByPath,
  listDailyNotes,
  resolveWikiTarget,
  type Backlink,
  type BacklinkContext,
  type BacklinkContextPage,
  type BacklinkContextPageOptions,
  type BacklinkSourceCursor,
  type ConflictedNote,
  type DailyNoteRow,
  type DailyNotesRange,
  type DuplicateIdGroup,
  type NoteRow,
  type PinnedNote,
  type TagSuggestion,
  type WikiLinkSuggestionResult,
} from './queries.ts'
export { resolveNoteTarget } from './resolve-target.ts'
export {
  listNotes,
  listNoteTags,
  listRecentNotes,
  type NoteListEntry,
  type NoteListOptions,
  type NoteTagFacet,
  type RecentNoteRow,
  type RecentNotesOptions,
} from './note-list.ts'
export {
  aliasHint,
  rankWikiSuggestions,
  mergeDateSuggestions,
  serializeWikiSuggestionAddress,
  type WikiLinkSuggestion,
  type WikiSuggestion,
  type GeneratedDate,
} from './suggest.ts'
export type { DateSuggestion, DateSuggestionContext } from './date-suggestion-types.ts'
export { generateDateSuggestions } from './date-suggestions.ts'
export {
  parseHighlights,
  randomNotePath,
  HIGHLIGHT_START,
  HIGHLIGHT_END,
  type HighlightSegment,
} from './search.ts'
export { lineAt, lineSnippet, previewSnippet } from './snippet.ts'
export {
  blockContextAt,
  blockContextLinesAt,
  prepareBlockContext,
  type BlockContextLines,
  type BlockContextSource,
} from './block-context.ts'
export { extractSnippetTasks, type SnippetTask } from './snippet-tasks.ts'
export { parseSearchQuery, type ParsedSearchQuery, type SearchFilters } from './filter-query.ts'
export {
  searchWithFilters,
  type FilteredSearchHit,
  type FilteredSearchOptions,
} from './filtered-search.ts'
export {
  rewriteLinksForTitleChange,
  rewritePathLinksForMove,
  nextAliases,
  type RenameBacklink,
  type RenameIo,
  type TitleRenameRewriteOptions,
  type TitleRenameRewriteResult,
} from './rename.ts'
