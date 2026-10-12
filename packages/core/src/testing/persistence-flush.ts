import type {
  PersistenceFlusher,
  PersistenceFlusherKind,
  PersistenceFlushService,
} from '../app/persistence-flush-service.ts'

export interface TestPersistenceFlushService extends PersistenceFlushService {
  /** How many times `flushAll` ran. */
  flushAllCalls(): number
  /** The installed flusher of `kind`, or `null`. */
  flusher(kind: PersistenceFlusherKind): PersistenceFlusher | null
  /** Run the documents flusher, then the backup flusher, as an exit would. Never rejects. */
  triggerFlush(): Promise<void>
  /** How many policies are installed and not yet removed. */
  installedPolicies(): { desktopQuit: number; mobileBackground: number }
}

/** An in-memory {@link PersistenceFlushService}. Its policies listen to nothing. */
export function createTestPersistenceFlushService(): TestPersistenceFlushService {
  const flushers = new Map<PersistenceFlusherKind, PersistenceFlusher>()
  const policies = { desktopQuit: 0, mobileBackground: 0 }
  let flushAllCount = 0

  const runFlushers = async (): Promise<void> => {
    for (const kind of ['documents', 'backup'] as const) {
      try {
        await flushers.get(kind)?.()
      } catch {
        // A failed flusher never blocks the next one.
      }
    }
  }

  const install = (policy: keyof typeof policies): (() => void) => {
    policies[policy] += 1
    let installed = true
    return () => {
      if (installed) {
        installed = false
        policies[policy] -= 1
      }
    }
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
      flushAllCount += 1
      await runFlushers()
    },
    installDesktopQuitPolicy: () => install('desktopQuit'),
    installMobileBackgroundPolicy: () => install('mobileBackground'),
    flushAllCalls: () => flushAllCount,
    flusher: (kind) => flushers.get(kind) ?? null,
    triggerFlush: runFlushers,
    installedPolicies: () => ({ ...policies }),
  }
}
