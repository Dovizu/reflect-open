import { defaultPersistenceFlush } from '@reflect/core'
import { flushOpenDocuments } from '@/editor/open-documents.ts'

/** Flush dirty state on window close, app quit, and page unload; returns the teardown. */
export function installQuitFlush(): () => void {
  const persistenceFlush = defaultPersistenceFlush()
  const unregister = persistenceFlush.registerFlusher('documents', flushOpenDocuments)
  const uninstall = persistenceFlush.installDesktopQuitPolicy()
  return () => {
    uninstall()
    unregister()
  }
}
