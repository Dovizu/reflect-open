import { defaultStorage, setDefaultStorage } from '@reflect/core'
import { StorageStore } from '@/lib/storage.ts'

const sessionStorageStores = new Map<string, StorageStore>()

/** The session store for `key`, created on first use and shared from then on. */
export function getSessionStorageStore(key: string): StorageStore {
  const existing = sessionStorageStores.get(key)
  if (existing !== undefined) {
    return existing
  }
  const store = new StorageStore(key, () => defaultStorage().session)
  sessionStorageStores.set(key, store)
  return store
}

/** Test seam: drop the default storage so the next read reaches sessionStorage again. */
export function resetSessionStorageStores(): void {
  sessionStorageStores.clear()
  setDefaultStorage(null)
}
