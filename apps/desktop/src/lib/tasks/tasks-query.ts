import { queryOptions } from '@tanstack/react-query'
import type { AppServices } from '@reflect/core'
import { queryKeys } from '@/lib/query-client.ts'

/**
 * The TanStack Query key for the open-tasks list, scoped to the graph root so a
 * graph switch never serves the previous graph's rows. Shared by the screen
 * (which reads it) and a task row (which optimistically updates it on
 * completion), so the two can't drift.
 */
export function createOpenTasksQueryOptions(
  ctx: Pick<AppServices, 'tasks'>,
  graphRoot: string | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.index.openTasks(graphRoot),
    queryFn: () => ctx.tasks.getOpenTasks(),
  })
}

/**
 * The query options for the completed-tasks list (the "show archived" surface),
 * scoped like {@link createOpenTasksQueryOptions}. Shared so completing a task
 * can move its row from the open cache into this one optimistically rather than
 * letting it vanish until the refetch.
 */
export function createCompletedTasksQueryOptions(
  ctx: Pick<AppServices, 'tasks'>,
  graphRoot: string | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.index.completedTasks(graphRoot),
    queryFn: () => ctx.tasks.getCompletedTasks(),
  })
}
