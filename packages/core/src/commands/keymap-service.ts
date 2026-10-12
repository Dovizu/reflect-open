import { defaultPlatform, type PlatformFacts } from '../app/platform-service.ts'
import { formatBinding, normalizeBinding } from './keybindings.ts'

export type KeymapScope = 'editor' | 'app'

/**
 * The central keymap registry. Every shortcut the app binds registers
 * through {@link KeymapService.register}, which rejects duplicates so
 * bindings can never silently collide across features.
 */
export interface KeymapService {
  /**
   * Register `bindings` under `scope` and return them, throwing on any
   * already-taken keystroke. Bindings are compared after `normalizeBinding`,
   * so `Mod-Alt-1` and `Alt-Mod-1` collide. `Meta` is rejected: it means ⌘ on
   * Apple but the Windows/Super key elsewhere, so bindings spell the command
   * key `Mod`. All-or-nothing: validation happens before any key is
   * committed, so a colliding batch never leaves the registry partially
   * mutated.
   */
  register<T>(scope: KeymapScope, bindings: Record<string, T>): Record<string, T>
  /** Every registered binding, as registered. */
  list(): ReadonlyMap<string, KeymapScope>
  /** One plain-text label for tooltips and AT, e.g. `⌘D` on Apple, `Ctrl+D` elsewhere. */
  formatLabel(binding: string): string
}

export interface KeymapServiceDeps {
  platform: Pick<PlatformFacts, 'isApplePlatform'>
}

export function createKeymapService(deps: KeymapServiceDeps): KeymapService {
  const { platform } = deps
  const registeredBindings = new Map<string, KeymapScope>()
  /** Normalized binding → the binding as registered. */
  const registeredKeystrokes = new Map<string, string>()

  return {
    register(scope, bindings) {
      const apple = platform.isApplePlatform
      const claimed = new Map<string, string>()
      for (const binding of Object.keys(bindings)) {
        if (binding.split('-').slice(0, -1).includes('Meta')) {
          throw new Error(`keybinding "${binding}" uses Meta; use Mod instead`)
        }
        const keystroke = normalizeBinding(binding, apple)
        const existing = registeredKeystrokes.get(keystroke) ?? claimed.get(keystroke)
        if (existing !== undefined) {
          const owner = registeredBindings.get(existing) ?? scope
          throw new Error(
            `duplicate keybinding "${binding}": already registered by the ${owner} scope as "${existing}"`,
          )
        }
        claimed.set(keystroke, binding)
      }
      for (const [keystroke, binding] of claimed) {
        registeredKeystrokes.set(keystroke, binding)
        registeredBindings.set(binding, scope)
      }
      return bindings
    },
    list: () => registeredBindings,
    formatLabel(binding) {
      const apple = platform.isApplePlatform
      return formatBinding(binding, apple).join(apple ? '' : '+')
    },
  }
}

let installedService: KeymapService | null = null
let fallback: KeymapService | null = null

/**
 * The process-wide `KeymapService`. Unless one is installed, it is one
 * registry that reads the current default platform on every call.
 */
export function defaultKeymap(): KeymapService {
  if (installedService !== null) {
    return installedService
  }
  fallback ??= createKeymapService({
    platform: {
      // Resolved per call: the platform may be installed later.
      get isApplePlatform() {
        return defaultPlatform().isApplePlatform
      },
    },
  })
  return fallback
}

/** Install the process-wide `KeymapService`; `null` restores the fallback registry. */
export function setDefaultKeymap(service: KeymapService | null): void {
  installedService = service
}
