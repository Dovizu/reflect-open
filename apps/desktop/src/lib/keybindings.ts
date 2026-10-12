/**
 * Display formatting for keymap-registry bindings (`Mod-d`, `Mod-\`, …): the
 * pure helpers from `@reflect/core`, plus the ones that read the running
 * platform.
 */

import { defaultKeymap, defaultPlatform } from '@reflect/core'

export { formatBinding } from '@reflect/core'

/** True on macOS/iOS — where Mod renders as ⌘ rather than Ctrl. */
export function isApplePlatform(): boolean {
  return defaultPlatform().isApplePlatform
}

/** One plain-text label for tooltips and AT, e.g. `⌘D` on Apple, `Ctrl+D` elsewhere. */
export function formatBindingLabel(binding: string): string {
  return defaultKeymap().formatLabel(binding)
}
