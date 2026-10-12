import type { ColorScheme, PlatformService } from '../app/platform-service.ts'
import type { StorageService } from '../app/storage-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { ThemePreference } from './schema.ts'
import type { SettingsService } from './settings-service.ts'

/** The concrete theme applied to the document. */
export type ResolvedTheme = ColorScheme

/**
 * The local storage key that mirrors the theme preference for the next
 * launch. `public/theme-init.js` repeats this literal, because it runs
 * unbundled before the app boots.
 */
export const THEME_PREFERENCE_CACHE_KEY = 'reflect.theme.preference'

/**
 * The app theme: the `theme` setting resolved against the system color
 * scheme. After a successful settings load, the preference (not the resolved
 * theme) is mirrored into local storage so the next launch can paint it
 * before the settings arrive. After a failed load nothing is mirrored,
 * because changes are session-only.
 */
export interface ThemeService {
  preference: () => ThemePreference
  resolved: () => ResolvedTheme
  /** True once the settings load has ended, successfully or not. */
  settled: () => boolean
  setPreference: (preference: ThemePreference) => void
  /** Calls `listener` after the preference, the resolved theme, or `settled()` changes. */
  subscribe: (listener: () => void) => Unlisten
  /** Resolves once the settings load has ended, successfully or not. */
  whenSettled: () => Promise<void>
}

export function createThemeService(deps: {
  settings: SettingsService
  storage: StorageService
  platform: PlatformService
}): ThemeService {
  const { settings, storage, platform } = deps
  const listeners = new Set<() => void>()

  let started = false
  let system: ColorScheme = 'light'
  let preference: ThemePreference = 'system'
  let isSettled = false
  let mirrored: ThemePreference | null = null

  const resolve = (): ResolvedTheme => (preference === 'system' ? system : preference)

  const sync = (): void => {
    const previous = { preference, resolved: resolve(), settled: isSettled }
    preference = settings.get().theme
    const status = settings.status()
    isSettled = status !== 'loading'
    if (status === 'loaded' && mirrored !== preference) {
      mirrored = preference
      storage.local.set(THEME_PREFERENCE_CACHE_KEY, preference)
    }
    if (
      previous.preference !== preference ||
      previous.resolved !== resolve() ||
      previous.settled !== isSettled
    ) {
      for (const listener of listeners) {
        listener()
      }
    }
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
    system = platform.colorScheme()
    platform.subscribeColorScheme((value) => {
      if (value === system) {
        return
      }
      const before = resolve()
      system = value
      if (resolve() !== before) {
        for (const listener of listeners) {
          listener()
        }
      }
    })
    settings.subscribe(sync)
    sync()
  }

  return {
    preference() {
      start()
      return preference
    },
    resolved() {
      start()
      return resolve()
    },
    settled() {
      start()
      return isSettled
    },
    setPreference(next) {
      start()
      settings.update({ theme: next })
    },
    subscribe(listener) {
      start()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async whenSettled() {
      start()
      await settings.whenLoaded()
    },
  }
}
