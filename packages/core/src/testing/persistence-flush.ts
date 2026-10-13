import type { Unlisten } from '../unlisten.ts'
import type { OpenDocumentsService } from '../documents/open-documents-service.ts'
import type {
  PersistenceFlusher,
  PersistenceFlusherKind,
  PersistenceFlushService,
} from '../app/persistence-flush-service.ts'

export type TestPersistenceFlushService = PersistenceFlushService

class TestPersistenceFlushServiceImpl implements TestPersistenceFlushService {
  readonly #flushers = new Map<PersistenceFlusherKind, PersistenceFlusher>()

  constructor(openDocuments: Pick<OpenDocumentsService, 'flushAll'> | undefined) {
    if (openDocuments !== undefined) {
      this.#flushers.set('documents', () => openDocuments.flushAll())
    }
  }

  registerFlusher(kind: PersistenceFlusherKind, fn: PersistenceFlusher): Unlisten {
    this.#flushers.set(kind, fn)
    return () => {
      if (this.#flushers.get(kind) === fn) {
        this.#flushers.delete(kind)
      }
    }
  }

  async flushAll(): Promise<void> {
    for (const kind of ['documents', 'backup'] as const) {
      try {
        await this.#flushers.get(kind)?.()
      } catch {
        // A failed flusher never blocks the next one.
      }
    }
  }

  startFlushAll(): void {
    void this.flushAll()
  }
}

/**
 * An in-memory {@link PersistenceFlushService}.
 */
export function createTestPersistenceFlushService(deps?: {
  openDocuments?: Pick<OpenDocumentsService, 'flushAll'>
}): TestPersistenceFlushService {
  return new TestPersistenceFlushServiceImpl(deps?.openDocuments)
}
