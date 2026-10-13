import type { Unlisten } from '../unlisten.ts'

/**
 * Opaque handle for one finite-length native background execution assertion.
 */
export type BackgroundTaskToken = string

/**
 * The app activity signals that business services follow, and the native
 * background-task handshake.
 */
export interface ActivityPort {
  /**
   * Window focus, network back, or the page turning visible; throttled per subscription.
   */
  subscribeResume(listener: () => void): Unlisten
  /**
   * Window focus or network back, unthrottled.
   */
  subscribeWake(listener: () => void): Unlisten
  /**
   * Window focus alone, unthrottled.
   */
  subscribeFocus(listener: () => void): Unlisten
  subscribeVisible(listener: () => void): Unlisten
  subscribeHidden(listener: () => void): Unlisten
  isHidden(): boolean
  /**
   * Ask the shell to keep running after the OS backgrounds the app; `null` when unavailable.
   */
  beginBackgroundTask(): Promise<BackgroundTaskToken | null>
  /**
   * Balance {@link beginBackgroundTask}. Expired or repeated tokens are no-ops.
   */
  endBackgroundTask(token: BackgroundTaskToken): Promise<void>
}

/**
 * A background operation as product status: a label, optional progress, and
 * a lingering warning or failure so errors from backgrounded work are seen.
 */
export interface Operation {
  id: number
  label: string
  description: string | null
  progress: { done: number; total: number } | null
  status: 'running' | 'warning' | 'failed'
  persistent: boolean
  action: OperationAction | null
  /**
   * The lingering line under the label when the operation needs attention.
   */
  message: string | null
}

export interface OperationAction {
  label: string
  run: () => void | Promise<void>
}

export interface OperationOptions {
  description?: string | undefined
  persistent?: boolean | undefined
  action?: OperationAction | undefined
}

export interface OperationHandle {
  progress(done: number, total: number): void
  /**
   * The operation completed; its entry disappears.
   */
  done(): void
  /**
   * The operation completed with caveats; its warning lingers briefly.
   */
  warn(message: string): void
  /**
   * The operation failed; the entry lingers briefly so the error is seen.
   */
  fail(message: string): void
  /**
   * Remove the operation immediately.
   */
  dismiss(): void
}

/**
 * Where business code reports visible background work.
 */
export interface ProgressPort {
  /**
   * Begins a visible background operation.
   */
  start(label: string, options?: OperationOptions): OperationHandle
}
