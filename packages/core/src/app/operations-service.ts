import type { Unlisten } from '../ipc/ipc-service.ts'
import { defaultClock, type ClockService } from './clock-service.ts'

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
  /** The lingering line under the label when the operation needs attention. */
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
  progress: (done: number, total: number) => void
  /** The operation completed; its entry disappears. */
  done: () => void
  /** The operation completed with caveats; its warning lingers briefly. */
  warn: (message: string) => void
  /** The operation failed; the entry lingers briefly so the error is seen. */
  fail: (message: string) => void
  /** Remove the operation immediately. */
  dismiss: () => void
}

/** The app-wide list of visible background operations. */
export interface OperationsService {
  /** Begins a visible background operation. */
  start(label: string, options?: OperationOptions): OperationHandle
  /** Removes an operation by id. */
  dismiss(id: number): void
  /** Listeners run synchronously inside the mutation that caused them. */
  subscribe(listener: () => void): Unlisten
  /** The current operations, newest last. The array changes identity on every change. */
  getAll(): readonly Operation[]
}

/** How long a warning or failure lingers after the minimum visible time. */
export const LINGER_MS = 8000
/**
 * Once shown, an entry stays visible at least this long, so a fast operation
 * does not flash for a single frame.
 */
export const MIN_VISIBLE_MS = 1200

export function createOperationsService(deps: { clock: ClockService }): OperationsService {
  const { clock } = deps
  let nextId = 1
  let operations: readonly Operation[] = []
  const listeners = new Set<() => void>()

  const emit = (): void => {
    for (const listener of listeners) {
      listener()
    }
  }

  const patch = (id: number, change: Partial<Operation>): void => {
    let changed = false
    operations = operations.map((operation) => {
      if (operation.id !== id) {
        return operation
      }
      changed = true
      return { ...operation, ...change }
    })
    if (changed) {
      emit()
    }
  }

  const remove = (id: number): void => {
    const before = operations.length
    operations = operations.filter((operation) => operation.id !== id)
    if (operations.length !== before) {
      emit()
    }
  }

  return {
    start(label, options) {
      const id = nextId++
      const shownAt = clock.now()
      const persistent = options?.persistent ?? false
      operations = [
        ...operations,
        {
          id,
          label,
          description: options?.description ?? null,
          progress: null,
          status: 'running',
          persistent,
          action: options?.action ?? null,
          message: null,
        },
      ]
      emit()
      const removeAfterMinimum = (extra: number): void => {
        if (persistent && extra > 0) {
          return
        }
        const visibleFor = clock.now() - shownAt
        const wait = Math.max(0, MIN_VISIBLE_MS - visibleFor) + extra
        if (wait === 0) {
          remove(id)
        } else {
          clock.setTimeout(() => remove(id), wait)
        }
      }
      return {
        progress: (done, total) => patch(id, { progress: { done, total } }),
        done: () => removeAfterMinimum(0),
        warn: (message) => {
          patch(id, { status: 'warning', message })
          removeAfterMinimum(LINGER_MS)
        },
        fail: (message) => {
          patch(id, { status: 'failed', message })
          removeAfterMinimum(LINGER_MS)
        },
        dismiss: () => remove(id),
      }
    },
    dismiss: remove,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getAll: () => operations,
  }
}

let defaultService: OperationsService | null = null

/** The process-wide operations; built over {@link defaultClock} unless {@link setDefaultOperations} installed another. */
export function defaultOperations(): OperationsService {
  defaultService ??= createOperationsService({ clock: defaultClock() })
  return defaultService
}

/** Installs the process-wide operations; `null` restores a lazily created one. */
export function setDefaultOperations(service: OperationsService | null): void {
  defaultService = service
}
