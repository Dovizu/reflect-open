import type { KeyValueStore, StorageService } from '../app/storage-service.ts'

export interface TestStorageService extends StorageService {
  /** A snapshot of every stored key in both areas. */
  dump(): { local: Record<string, string>; session: Record<string, string> }
}

function createMemoryStore(
  initial: Record<string, string>,
): KeyValueStore & { dump(): Record<string, string> } {
  const values = new Map(Object.entries(initial))
  const listeners = new Map<string, Set<() => void>>()
  return {
    get: (key) => values.get(key) ?? null,
    set(key, value) {
      if ((values.get(key) ?? null) === value) {
        return
      }
      if (value === null) {
        values.delete(key)
      } else {
        values.set(key, value)
      }
      for (const listener of listeners.get(key) ?? []) {
        listener()
      }
    },
    subscribe(key, listener) {
      const keyListeners = listeners.get(key) ?? new Set<() => void>()
      listeners.set(key, keyListeners)
      keyListeners.add(listener)
      return () => {
        keyListeners.delete(listener)
      }
    },
    dump: () => Object.fromEntries(values),
  }
}

/** In-memory local and session storage, seeded from `initial`. */
export function createTestStorageService(
  initial: { local?: Record<string, string>; session?: Record<string, string> } = {},
): TestStorageService {
  const local = createMemoryStore(initial.local ?? {})
  const session = createMemoryStore(initial.session ?? {})
  return {
    local,
    session,
    dump: () => ({ local: local.dump(), session: session.dump() }),
  }
}
