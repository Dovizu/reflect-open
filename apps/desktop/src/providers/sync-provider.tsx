import { useMemo } from 'react'
import { ReflectError, type BackupService, type BackupState } from '@reflect/core'
import { useGraphServices } from '@/services/services-provider.tsx'
import { useServiceState } from '@/services/use-service-state.ts'

export type { BackupState, ConnectExistingResult } from '@reflect/core'

type SyncContextValue = { backup: BackupState } & Pick<
  BackupService,
  'connectNewRepo' | 'connectExistingRepo' | 'disconnectGraph' | 'signOut' | 'backUpNow'
>

const LOADING: BackupState = { phase: 'loading' }

/** What the surface reads where the graph runs no backup service. */
const NO_BACKUP = {
  subscribe: () => () => {},
  getState: (): BackupState => LOADING,
}

/**
 * Backup state + actions of the open graph's `BackupService`. A note window
 * runs none: its state stays 'loading' (the note window edits, main syncs).
 */
export function useSync(): SyncContextValue {
  const controller = useGraphServices({ optional: true })?.backup ?? null
  const backup = useServiceState(controller ?? NO_BACKUP)

  return useMemo<SyncContextValue>(() => {
    const require = (): BackupService => {
      if (controller === null) {
        throw new ReflectError('io', 'backup is still initializing')
      }
      return controller
    }
    return {
      backup,
      connectNewRepo: (name) => require().connectNewRepo(name),
      connectExistingRepo: (ref, options) => require().connectExistingRepo(ref, options),
      disconnectGraph: () => require().disconnectGraph(),
      signOut: () => require().signOut(),
      backUpNow: () => require().backUpNow(),
    }
  }, [controller, backup])
}

/**
 * Like {@link useSync}, but `null` where the graph runs no backup service:
 * no graph session is open (the mobile settings sheet in the plain-browser
 * dev harness and in screen tests), and those surfaces hide their sync rows.
 */
export function useSyncContext(): SyncContextValue | null {
  const sync = useSync()
  const backup = useGraphServices({ optional: true })?.backup ?? null
  return backup === null ? null : sync
}
