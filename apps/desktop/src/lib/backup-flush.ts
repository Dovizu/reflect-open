import { defaultPersistenceFlush } from '@reflect/core'

/** Install the active graph's quit-time local commit; returns its remover. */
export function registerBackupFlusher(fn: () => Promise<void>): () => void {
  return defaultPersistenceFlush().registerFlusher('backup', fn)
}
