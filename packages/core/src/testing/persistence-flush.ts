import type { OpenDocumentsService } from '../documents/open-documents-service.ts'
import type {
  PersistenceFlusher,
  PersistenceFlusherKind,
  PersistenceFlushService,
} from '../app/persistence-flush-service.ts'

export type TestPersistenceFlushService = PersistenceFlushService

/** An in-memory {@link PersistenceFlushService}. Its policies listen to nothing. */
export function createTestPersistenceFlushService(deps?: {
  openDocuments?: Pick<OpenDocumentsService, 'flushAll'>
}): TestPersistenceFlushService {
  const flushers = new Map<PersistenceFlusherKind, PersistenceFlusher>()
  const openDocuments = deps?.openDocuments
  if (openDocuments !== undefined) {
    flushers.set('documents', () => openDocuments.flushAll())
  }

  return {
    registerFlusher(kind, fn) {
      flushers.set(kind, fn)
      return () => {
        if (flushers.get(kind) === fn) {
          flushers.delete(kind)
        }
      }
    },
    async flushAll() {
      for (const kind of ['documents', 'backup'] as const) {
        try {
          await flushers.get(kind)?.()
        } catch {
          // A failed flusher never blocks the next one.
        }
      }
    },
    installDesktopQuitPolicy: () => () => undefined,
    installMobileBackgroundPolicy: () => () => undefined,
  }
}
