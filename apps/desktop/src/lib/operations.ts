import {
  defaultOperations,
  type Operation,
  type OperationHandle,
  type OperationOptions,
} from '@reflect/core'
import { useSyncExternalStore } from 'react'

export type { Operation, OperationAction, OperationHandle, OperationOptions } from '@reflect/core'

/** Begin a visible background operation. */
export function startOperation(label: string, options?: OperationOptions): OperationHandle {
  return defaultOperations().start(label, options)
}

/** Remove an operation by id, usually after the user dismisses its toast. */
export function dismissOperation(id: number): void {
  defaultOperations().dismiss(id)
}

/** Subscribe to store changes. Returns an unsubscribe. */
export function subscribeOperations(listener: () => void): () => void {
  return defaultOperations().subscribe(listener)
}

/** Snapshot of the current operations, newest last. */
export function getOperations(): readonly Operation[] {
  return defaultOperations().getAll()
}

/** The current operations, newest last. Re-renders on every store change. */
export function useOperations(): readonly Operation[] {
  return useSyncExternalStore(subscribeOperations, getOperations)
}
