import type { Unlisten } from '../ipc/ipc-service.ts'
import {
  defaultFileChanges,
  type FileChange,
  type FileChangeSource,
} from './file-change-service.ts'

export type FileChangeHandler = (changes: FileChange[], source: FileChangeSource) => void

/** `defaultFileChanges().subscribe`. */
export function subscribeFileChanges(handler: FileChangeHandler): Promise<Unlisten> {
  return Promise.resolve(
    defaultFileChanges().subscribe(({ changes, source }) => handler(changes, source)),
  )
}

/** `defaultFileChanges().subscribeReconcile`. */
export function subscribeReconcileRequests(handler: () => void): Promise<Unlisten> {
  return Promise.resolve(defaultFileChanges().subscribeReconcile(handler))
}

/** `defaultFileChanges().emit`. */
export function emitFileChanges(changes: FileChange[], source: FileChangeSource): void {
  defaultFileChanges().emit({ changes, source })
}
