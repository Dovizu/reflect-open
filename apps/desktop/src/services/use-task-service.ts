import { defaultTasks, type TaskService } from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/** The `TaskService` of the nearest `AppServicesProvider`, else the process-wide default. */
export function useTaskService(): TaskService {
  return useOptionalAppServices()?.tasks ?? defaultTasks()
}
