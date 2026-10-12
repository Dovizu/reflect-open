import type { ThemePreference } from '../settings/schema.ts'
import type { ResolvedTheme, ThemeService } from '../settings/theme-service.ts'

export interface TestThemeService extends ThemeService {
  /** Makes `resolved()` return `value`: changes the system scheme, or moves a pinned preference to `value`. */
  setResolved: (value: ResolvedTheme) => void
  /** Every preference passed to `setPreference`, oldest first. */
  writes: () => ThemePreference[]
}

/** An in-memory {@link ThemeService} that is already settled. `system` resolves to `light` until `setResolved`. */
export function createTestThemeService(preference: ThemePreference = 'system'): TestThemeService {
  let current = preference
  let system: ResolvedTheme = 'light'
  const written: ThemePreference[] = []
  const listeners = new Set<() => void>()

  const resolve = (): ResolvedTheme => (current === 'system' ? system : current)

  const update = (change: () => void): void => {
    const before = { preference: current, resolved: resolve() }
    change()
    if (before.preference !== current || before.resolved !== resolve()) {
      for (const listener of listeners) {
        listener()
      }
    }
  }

  return {
    preference: () => current,
    resolved: resolve,
    settled: () => true,
    setPreference(next) {
      written.push(next)
      update(() => {
        current = next
      })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    whenSettled: async () => {},
    setResolved(value) {
      update(() => {
        if (current === 'system') {
          system = value
        } else {
          current = value
        }
      })
    },
    writes: () => [...written],
  }
}
