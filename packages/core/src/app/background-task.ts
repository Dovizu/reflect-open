import { defaultLifecycle, type BackgroundTaskToken } from './lifecycle-service.ts'

export type { BackgroundTaskToken } from './lifecycle-service.ts'

/**
 * Ask the native shell to keep a finite persistence pass running after iOS
 * backgrounds the app. Returns `null` when no assertion is available; callers
 * must still attempt their best-effort flush.
 */
export function beginBackgroundTask(): Promise<BackgroundTaskToken | null> {
  return defaultLifecycle().beginBackgroundTask()
}

/**
 * Balance {@link beginBackgroundTask}. The shell treats expired or repeated
 * tokens as no-ops, so cleanup is safe from a `finally` block.
 */
export function endBackgroundTask(token: BackgroundTaskToken): Promise<void> {
  return defaultLifecycle().endBackgroundTask(token)
}
