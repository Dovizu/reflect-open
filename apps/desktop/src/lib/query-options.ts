import { queryOptions } from '@tanstack/react-query'
import type { AppServices } from '@reflect/core'
import { queryKeys } from '@/lib/query-client.ts'

/** Conflicted-note rows shared by every sync status and settings surface. */
export function createConflictedNotesQueryOptions(
  ctx: Pick<AppServices, 'indexQuery'>,
  root: string | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.index.conflictedNotes(root),
    queryFn: () => ctx.indexQuery.getConflictedNotes(),
  })
}

/** Duplicate note IDs shared by the Git and iCloud settings surfaces. */
export function createDuplicateNoteIdsQueryOptions(
  ctx: Pick<AppServices, 'indexQuery'>,
  root: string | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.index.duplicateNoteIds(root),
    queryFn: () => ctx.indexQuery.getDuplicateNoteIds(),
  })
}

/** Templates shared by the settings list and insertion picker. */
export function createTemplatesQueryOptions(
  ctx: Pick<AppServices, 'indexQuery'>,
  root: string | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.index.templates(root),
    queryFn: () => ctx.indexQuery.listTemplates(),
  })
}

/** Daily-note dates shared by desktop and mobile calendars. */
export function createDailyDatesQueryOptions(
  ctx: Pick<AppServices, 'dailyNotes'>,
  root: string | undefined,
  start: string,
  end: string,
) {
  return queryOptions({
    queryKey: queryKeys.index.dailyDates(root, start, end),
    queryFn: () => ctx.dailyNotes.dailyDatesInRange(start, end),
  })
}

/** Persisted chat conversations shared by desktop and mobile history menus. */
export function createChatConversationsQueryOptions(
  ctx: Pick<AppServices, 'chatHistory'>,
  root: string | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.chat.conversations(root),
    queryFn: () => ctx.chatHistory.listRecent(),
  })
}
