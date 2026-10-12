import type { AppServices } from '@reflect/core'

/** Flush dirty state every time the app is backgrounded; returns the teardown. */
export function installBackgroundFlush(
  ctx: Pick<AppServices, 'persistenceFlush' | 'openDocuments'>,
): () => void {
  const { persistenceFlush, openDocuments } = ctx
  const unregister = persistenceFlush.registerFlusher('documents', () => openDocuments.flushAll())
  const uninstall = persistenceFlush.installMobileBackgroundPolicy()
  return () => {
    uninstall()
    unregister()
  }
}
