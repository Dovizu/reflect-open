import { beforeEach } from 'vitest'
import '@/styles/index.css'
import { resetLocalStorageStores } from '@/lib/local-storage.ts'
import { resetSessionStorageStores } from '@/lib/session-storage.ts'

// The default storage caches values in memory, so a test that clears
// localStorage or sessionStorage would otherwise keep reading what the
// previous one left behind.
beforeEach(() => {
  resetLocalStorageStores()
  resetSessionStorageStores()
})
