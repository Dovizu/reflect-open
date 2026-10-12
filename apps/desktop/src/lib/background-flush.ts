import { defaultPersistenceFlush } from '@reflect/core'
import { flushOpenDocuments } from '@/editor/open-documents.ts'

/** Flush dirty state every time the app is backgrounded; returns the teardown. */
export function installBackgroundFlush(): () => void {
  const persistenceFlush = defaultPersistenceFlush()
  const unregister = persistenceFlush.registerFlusher('documents', flushOpenDocuments)
  const uninstall = persistenceFlush.installMobileBackgroundPolicy()
  return () => {
    uninstall()
    unregister()
  }
}
