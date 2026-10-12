import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createV1ImportService } from '@reflect/core'
import { V1ImportDialog } from '@/components/v1-import-dialog.tsx'
import type { V1ImportState } from '@/lib/v1-import-state.ts'
import { useAppServices } from '@/services/services-provider.tsx'

interface V1ImportContextValue {
  state: V1ImportState
  /** Kick off an import of the chosen `.zip`; ignored while one runs. */
  startImport: (zipPath: string) => void
  /** Ask the running import to stop (safe: nothing lands after a cancel). */
  cancelImport: () => void
  /** Clear a finished (done/failed) import back to idle. */
  dismiss: () => void
}

const V1ImportContext = createContext<V1ImportContextValue | null>(null)

interface V1ImportProviderProps {
  children: ReactNode
}

/**
 * Owns the Reflect V1 import for the workspace: the settings section only
 * picks the zip; the import itself lives in a `V1ImportService` of this
 * workspace so navigating away from settings can't orphan it. Renders the
 * modal progress dialog ({@link V1ImportDialog}) above the routed views — the
 * import is the only activity until it finishes, errors, or is cancelled.
 */
export function V1ImportProvider({ children }: V1ImportProviderProps): ReactElement {
  const { ipc, fileChanges, graphSession, clock, logger } = useAppServices()
  const [service] = useState(() =>
    createV1ImportService({ ipc, fileChanges, graphSession, clock, logger }),
  )
  const state = useSyncExternalStore(service.subscribe, service.getState)

  // Unmounting mid-import (graph switch, app teardown) cancels the import.
  useEffect(() => service.attach(), [service])

  const value = useMemo(
    () => ({
      state,
      startImport: service.start,
      cancelImport: service.cancel,
      dismiss: service.dismiss,
    }),
    [state, service],
  )

  return (
    <V1ImportContext value={value}>
      {children}
      <V1ImportDialog state={state} onCancel={service.cancel} onDismiss={service.dismiss} />
    </V1ImportContext>
  )
}

/** The workspace's Reflect V1 import (state + controls). */
export function useV1Import(): V1ImportContextValue {
  const context = use(V1ImportContext)
  if (context === null) {
    throw new Error('useV1Import must be used within V1ImportProvider')
  }
  return context
}
