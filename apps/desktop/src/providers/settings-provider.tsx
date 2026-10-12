import { createContext, use, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import type { Settings, SettingsLoadOutcome } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

export type { SettingsLoadOutcome } from '@reflect/core'

interface SettingsContextValue {
  settings: Settings
  /** Merge `patch` into the settings: applied immediately, persisted async. */
  updateSettings: (patch: Partial<Settings>) => void
  /** Compute a patch from the latest settings; pre-load calls replay after hydration. */
  updateSettingsWith: (updater: (current: Settings) => Partial<Settings>) => void
  /** Resolve after the initial disk load; `'failed'` means session-only updates. */
  whenSettingsLoaded: () => Promise<SettingsLoadOutcome>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }): ReactElement {
  const { settings: service } = useAppServices()
  const settings = useSyncExternalStore(service.subscribe, service.get)
  const value: SettingsContextValue = {
    settings,
    updateSettings: service.update,
    updateSettingsWith: service.updateWith,
    whenSettingsLoaded: service.whenLoaded,
  }
  return <SettingsContext value={value}>{children}</SettingsContext>
}

/** Access the current settings and the updater. Use within a SettingsProvider. */
export function useSettings(options: { optional: true }): SettingsContextValue | null
export function useSettings(): SettingsContextValue
export function useSettings(options?: { optional: true }): SettingsContextValue | null {
  const context = use(SettingsContext)
  if (!context && !options?.optional) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
