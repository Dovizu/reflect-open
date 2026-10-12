import type { AppServices } from '@reflect/core'

/** Flush dirty state on window close, app quit, and page unload; returns the teardown. */
export function installQuitFlush(
  ctx: Pick<AppServices, 'persistenceFlush' | 'openDocuments'>,
): () => void {
  const { persistenceFlush, openDocuments } = ctx
  const unregister = persistenceFlush.registerFlusher('documents', () => openDocuments.flushAll())
  const uninstall = persistenceFlush.installDesktopQuitPolicy()
  return () => {
    uninstall()
    unregister()
  }
}
