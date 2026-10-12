import {
  createContext,
  use,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { UpdateState } from '@reflect/core'
import { attachUpdateToasts } from '@/components/update-toasts.ts'
import { useMainWindowEffect } from '@/hooks/use-main-window-effect.ts'
import { useAppServices } from '@/services/services-provider.tsx'

interface UpdateContextValue {
  state: UpdateState
  /**
   * False outside a desktop native shell (browser dev, iOS/Android): hide
   * update UI entirely. Mobile ships through the app stores, and the updater
   * plugins are only registered under `#[cfg(desktop)]`.
   */
  supported: boolean
  checkNow: () => Promise<void>
  install: () => Promise<void>
  restart: () => Promise<void>
  /** Retry what failed: the install after a failed install, otherwise the check. */
  retryAction: () => Promise<void>
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

interface UpdateProviderProps {
  children: ReactNode
  /**
   * Override the launch + periodic check. Defaults to on in the packaged app
   * and off in dev: `tauri dev` builds would otherwise prompt to "update" to
   * the released version.
   */
  autoCheck?: boolean
}

/**
 * Thin React shim over the app's `UpdateService`, surfaced through
 * `useSyncExternalStore`. Mounted above the graph gate so update checks run
 * from first launch, before any graph is open.
 */
export function UpdateProvider({ children, autoCheck }: UpdateProviderProps): ReactElement {
  const { update, platform, logger } = useAppServices()
  const supported = update.supported
  const resolvedAutoCheck = autoCheck ?? !platform.isDev

  // One checker per app: secondary note windows never poll for updates.
  useMainWindowEffect(() => {
    if (!supported) {
      return
    }
    const detachToasts = attachUpdateToasts({ update, logger })
    if (resolvedAutoCheck) {
      update.start()
    }
    return () => {
      detachToasts()
      update.dispose()
    }
  }, [update, supported, resolvedAutoCheck, logger])

  const state = useSyncExternalStore(update.subscribe, update.getState)

  const value = useMemo<UpdateContextValue>(
    () => ({
      state,
      supported,
      checkNow: () => update.checkNow(),
      install: () => update.install(),
      restart: () => update.restart(),
      retryAction: () => update.retryAction(),
    }),
    [update, state, supported],
  )

  return <UpdateContext value={value}>{children}</UpdateContext>
}

/** Update state + actions; must be used under an {@link UpdateProvider}. */
export function useUpdate(): UpdateContextValue {
  const value = use(UpdateContext)
  if (value === null) {
    throw new Error('useUpdate must be used within an UpdateProvider')
  }
  return value
}
