import {
  createContext,
  use,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  isICloudRoot,
  ReflectError,
  type BackupService,
  type BackupState,
  type ConnectExistingResult,
  type GithubRepoRef,
  type GraphInfo,
} from '@reflect/core'
import { useMainWindowEffect } from '@/hooks/use-main-window-effect.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

export type { BackupState, ConnectExistingResult } from '@reflect/core'

interface SyncContextValue {
  backup: BackupState
  /** `manualCreateNeeded` = the token type can't create repos (guide instead). */
  connectNewRepo: (name: string) => Promise<'connected' | 'manualCreateNeeded'>
  connectExistingRepo: (
    ref: GithubRepoRef,
    options?: { allowPublic?: boolean },
  ) => Promise<ConnectExistingResult>
  /** Stop backing this graph up (other graphs and the credential stay). */
  disconnectGraph: () => Promise<void>
  /** Sign the machine out of GitHub (every connected graph stops syncing). */
  signOut: () => Promise<void>
  backUpNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

const LOADING: BackupState = { phase: 'loading' }

interface SyncProviderProps {
  graph: GraphInfo
  children: ReactNode
}

/**
 * Thin React shim over core's `BackupService` lifecycle (Plan 12): one
 * service per (graph, index session), created and disposed by an effect,
 * surfaced through `useSyncExternalStore`. All sync behavior lives in the
 * service — this component owns nothing but the mounting. The service comes
 * from the nearest `AppServicesProvider`'s factory.
 */
export function SyncProvider({ graph, children }: SyncProviderProps): ReactElement {
  const { indexGeneration } = useGraph()
  const { backups, icloudSyncs, platform } = useAppServices()
  const metadataWatch = platform.surface.mobileApp
  const [controller, setController] = useState<BackupService | null>(null)

  // One backup service per app: a secondary note window mounting a
  // second one would race commits/pulls against the main window's. Its
  // sync state stays 'loading' — the note window edits, main syncs.
  useMainWindowEffect(() => {
    const next = backups.create({
      generation: graph.generation,
      indexGeneration,
    })
    // The service is an imperative lifecycle object created per (graph, index
    // session); it must be instantiated in an effect (it subscribes and starts)
    // and stored so useSyncExternalStore can read it.
    setController(next)
    void next.start()
    return () => {
      next.dispose()
      setController((current) => (current === next ? null : current))
    }
  }, [backups, graph, indexGeneration])

  // iCloud-hosted graphs additionally get the conflict lifecycle (Plan 21):
  // debounced conflict sweeps and shadow-base bookkeeping, plus — on mobile
  // only — the metadata-query watch that stands in for the file watcher.
  // Same per-(graph, index session) shape as the backup service; a graph
  // outside iCloud mounts nothing.
  useMainWindowEffect(() => {
    if (!isICloudRoot(graph.root)) {
      return
    }
    const icloud = icloudSyncs.create({
      root: graph.root,
      generation: graph.generation,
      indexGeneration,
      metadataWatch,
    })
    void icloud.start()
    return () => {
      icloud.dispose()
    }
  }, [icloudSyncs, graph, indexGeneration, metadataWatch])

  const backup = useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.getState ?? (() => LOADING),
  )

  const value = useMemo<SyncContextValue>(() => {
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

  return <SyncContext value={value}>{children}</SyncContext>
}

/** Backup state + actions; must be used under a {@link SyncProvider}. */
export function useSync(): SyncContextValue {
  const value = use(SyncContext)
  if (value === null) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return value
}

/**
 * Like {@link useSync}, but `null` outside a provider. For surfaces that also
 * render where no backup lifecycle is mounted — the mobile settings sheet in
 * the plain-browser dev harness and in screen tests — and degrade by hiding
 * their sync rows instead of crashing.
 */
export function useSyncContext(): SyncContextValue | null {
  return use(SyncContext)
}
