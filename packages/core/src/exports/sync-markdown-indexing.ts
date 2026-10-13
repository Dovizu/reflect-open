export {
  isDeviceFlowConfigured,
  suggestRepoName,
  type GithubAuth,
  type GithubUser,
} from '../sync/index.ts'
export {
  isPinned,
  pinnedOrder,
  parseNote,
  getTaskDueDate,
  type TaskLocator,
  type TaskRow,
  type TaskSnapshot,
  resolved,
  unresolved,
  splitFrontmatter,
  upsertFrontmatter,
  detectConflictMarkers,
  parseConflictMarkers,
  resolveConflictMarkers,
  type ConflictSide,
  displayNoteTitle,
  foldKey,
  foldTag,
  foldFallbackTitleKey,
  isTagName,
  type ConflictResolution,
  type Frontmatter,
  type Span,
  type Heading,
  type Resolution,
} from '../markdown/index.ts'
export {
  buildIndexedNote,
  CLAIM_TIER,
  encodeTaskBreadcrumbs,
  indexedNoteSchema,
  aliasHint,
  type TemplateEntry,
  parseHighlights,
  parseSearchQuery,
  type ParsedSearchQuery,
  type FilteredSearchOptions,
  type IndexedNote,
  type BacklinkContext,
  type BacklinkContextPage,
  type BacklinkSourceCursor,
  type SnippetTask,
  type ConflictedNote,
  type DuplicateIdGroup,
  type NoteRow,
  type NoteListEntry,
  type NoteTagFacet,
  type PinnedNote,
  type WikiLinkSuggestionResult,
  type DateSuggestionContext,
  type FileChange,
  type WikiSuggestion,
  type HighlightSegment,
  type FilteredSearchHit,
} from '../indexing/index.ts'
export { groupTaskContexts, type TaskContext, type TaskGroup } from '../tasks/group-tasks.ts'
export { type OpenTask } from '../tasks/open-task.ts'
export { resolveTaskEdit, type TaskDraftResolution } from '../tasks/task-content.ts'
export { getTaskKey, isSameTask } from '../tasks/task-identity.ts'
export { type InsertTaskTarget } from '../tasks/task-insert-target.ts'
export { previousTaskKey, todaysDailyTarget } from '../tasks/task-navigation.ts'
export { withDraftDueDate } from '../tasks/task-schedule-content.ts'
export {
  withoutReopenedTasks,
  type TaskAction,
  type TaskService,
  type TaskWriteResult,
} from '../tasks/task-service.ts'
export { composeVisibleTaskGroups, type TaskFilters } from '../tasks/task-visibility.ts'
