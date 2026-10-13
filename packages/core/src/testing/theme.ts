import type { Unlisten } from '../ipc/ipc-service.ts'
import type { ThemePreference } from '../settings/schema.ts'
import type { ResolvedTheme, ThemeService } from '../settings/theme-service.ts'

export interface TestThemeService extends ThemeService {
  /**
   * Makes `resolved()` return `value`: changes the system scheme, or moves a pinned preference to `value`.
   */
  setResolved(value: ResolvedTheme): void
  /**
   * Every preference passed to `setPreference`, oldest first.
   */
  writes(): ThemePreference[]
}

class TestThemeServiceImpl implements TestThemeService {
  #current: ThemePreference
  #system: ResolvedTheme = 'light'
  readonly #written: ThemePreference[] = []
  readonly #listeners = new Set<() => void>()

  constructor(preference: ThemePreference) {
    this.#current = preference
  }

  readonly preference = (): ThemePreference => this.#current

  readonly resolved = (): ResolvedTheme => this.#resolve()

  readonly settled = (): boolean => true

  readonly setPreference = (next: ThemePreference): void => {
    this.#written.push(next)
    this.#update(() => {
      this.#current = next
    })
  }

  readonly subscribe = (listener: () => void): Unlisten => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  async whenSettled(): Promise<void> {}

  setResolved(value: ResolvedTheme): void {
    this.#update(() => {
      if (this.#current === 'system') {
        this.#system = value
      } else {
        this.#current = value
      }
    })
  }

  writes(): ThemePreference[] {
    return [...this.#written]
  }

  #resolve(): ResolvedTheme {
    return this.#current === 'system' ? this.#system : this.#current
  }

  #update(change: () => void): void {
    const before = { preference: this.#current, resolved: this.#resolve() }
    change()
    if (before.preference !== this.#current || before.resolved !== this.#resolve()) {
      for (const listener of this.#listeners) {
        listener()
      }
    }
  }
}

/**
 * An in-memory {@link ThemeService} that is already settled. `system` resolves to `light` until `setResolved`.
 */
export function createTestThemeService(preference: ThemePreference = 'system'): TestThemeService {
  return new TestThemeServiceImpl(preference)
}
