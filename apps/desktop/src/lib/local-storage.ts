import { defaultStorage, setDefaultStorage } from '@reflect/core'
import { StorageStore } from '@/lib/storage.ts'

const localStorageStores = new Map<string, StorageStore>()

/** The local store for `key`, created on first use and shared from then on. */
export function getLocalStorageStore(key: string): StorageStore {
  const existing = localStorageStores.get(key)
  if (existing !== undefined) {
    return existing
  }
  const store = new StorageStore(key, () => defaultStorage().local)
  localStorageStores.set(key, store)
  return store
}

/** Test seam: drop the default storage so the next read reaches localStorage again. */
export function resetLocalStorageStores(): void {
  localStorageStores.clear()
  setDefaultStorage(null)
}
