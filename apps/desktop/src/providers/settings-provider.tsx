import type { Settings, SettingsLoadOutcome } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'
import { useServiceState } from '@/services/use-service-state.ts'

export type { SettingsLoadOutcome } from '@reflect/core'

interface SettingsValue {
  settings: Settings
  /** Merge `patch` into the settings: applied immediately, persisted async. */
  updateSettings: (patch: Partial<Settings>) => void
  /** Compute a patch from the latest settings; pre-load calls replay after hydration. */
  updateSettingsWith: (updater: (current: Settings) => Partial<Settings>) => void
  /** Resolve after the initial disk load; `'failed'` means session-only updates. */
  whenSettingsLoaded: () => Promise<SettingsLoadOutcome>
}

interface SettingsStore {
  readonly subscribe: (listener: () => void) => () => void
  readonly get: () => Settings | null
}

const NO_STORE: SettingsStore = {
  subscribe: () => () => {},
  get: () => null,
}

/** Access the current settings and the updater. Use within an `AppServicesProvider`. */
export function useSettings(options: { optional: true }): SettingsValue | null
export function useSettings(): SettingsValue
export function useSettings(options?: { optional: true }): SettingsValue | null {
  const service = useAppServices(options)?.settings ?? null
  const store: SettingsStore = service ?? NO_STORE
  const settings = useServiceState(store, store.get)
  if (service === null || settings === null) {
    return null
  }
  return {
    settings,
    updateSettings: service.update,
    updateSettingsWith: service.updateWith,
    whenSettingsLoaded: service.whenLoaded,
  }
}
