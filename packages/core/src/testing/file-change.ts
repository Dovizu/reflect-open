import type { FileChangeBatch, FileChangeService } from '../indexing/file-change-service.ts'

export interface TestFileChangeServiceOptions {
  /** Echo own writes onto the change stream. Defaults to `false`. */
  echoOwnWrites?: boolean
}

export interface TestFileChangeService extends FileChangeService {
  /** Notify every `subscribeReconcile` listener. */
  emitReconcile(): void
  /** Every batch delivered on the change stream, in order. */
  batches(): readonly FileChangeBatch[]
  /** Every path list passed to `reportOwnWrite`, in order. */
  ownWrites(): readonly (readonly string[])[]
  /** Whether the watcher was started and not stopped since. */
  watcherRunning(): boolean
  /** How many listeners of each kind are attached. */
  listenerCount(): { changes: number; reconcile: number; ownWrites: number }
}

/** An in-memory {@link FileChangeService} with no native watcher behind it. */
export function createTestFileChangeService(
  options?: TestFileChangeServiceOptions,
): TestFileChangeService {
  const echoOwnWrites = options?.echoOwnWrites ?? false
  const changeListeners = new Set<(batch: FileChangeBatch) => void>()
  const reconcileListeners = new Set<() => void>()
  const ownWriteListeners = new Set<(paths: readonly string[]) => void>()
  const delivered: FileChangeBatch[] = []
  const reported: (readonly string[])[] = []
  let running = false

  // Wrapped for identity, so one function added twice detaches independently.
  function attach<Args extends unknown[]>(
    listeners: Set<(...args: Args) => void>,
    listener: (...args: Args) => void,
  ): () => void {
    const deliver = (...args: Args): void => {
      listener(...args)
    }
    listeners.add(deliver)
    return () => {
      listeners.delete(deliver)
    }
  }

  function emit(batch: FileChangeBatch): void {
    delivered.push(batch)
    for (const listener of [...changeListeners]) {
      listener(batch)
    }
  }

  return {
    subscribe: (listener) => attach(changeListeners, listener),
    subscribeReconcile: (listener) => attach(reconcileListeners, listener),
    subscribeOwnWrites: (listener) => attach(ownWriteListeners, listener),
    emit,
    reportOwnWrite(changes) {
      const paths = changes.map((change) => change.path)
      reported.push(paths)
      for (const listener of [...ownWriteListeners]) {
        listener(paths)
      }
      if (echoOwnWrites) {
        emit({ changes: [...changes], source: 'own-write' })
      }
    },
    startWatcher: async () => {
      running = true
    },
    stopWatcher: async () => {
      running = false
    },
    emitReconcile() {
      for (const listener of [...reconcileListeners]) {
        listener()
      }
    },
    batches: () => [...delivered],
    ownWrites: () => [...reported],
    watcherRunning: () => running,
    listenerCount: () => ({
      changes: changeListeners.size,
      reconcile: reconcileListeners.size,
      ownWrites: ownWriteListeners.size,
    }),
  }
}
