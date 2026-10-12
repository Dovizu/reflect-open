import {
  createPlatformService,
  defaultPlatform,
  platformFacts,
  setDefaultPlatform,
  type PlatformSurface,
} from '@reflect/core'

/**
 * How the running surface differs from stock desktop. The facets are
 * deliberately separate (a future iPad-with-keyboard build could plausibly
 * split them):
 * - `touchEditor` — editors apply iOS text-input hygiene (pinned
 *   `spellcheck=false`: WebKit derives the keyboard's smart-punctuation
 *   traits from it, and smart punctuation corrupts markdown syntax) and
 *   explicit input traits — see `EditorInputTraits` (Plan 19, decision 7).
 * - `mobileApp` — shared components render their mobile variants, e.g.
 *   touch-sized conflict-resolution actions in the protected note notice.
 */
export type { PlatformSurface }

/**
 * Set surface facets (merged over the current state) by replacing the
 * default platform. The mobile root chunk calls this once at module scope.
 */
export function setPlatformSurface(next: Partial<PlatformSurface>): void {
  const current = defaultPlatform()
  setDefaultPlatform(
    createPlatformService(
      {
        ...platformFacts(current),
        surface: { ...current.surface, ...next },
      },
      undefined,
      (filePath, protocol) => current.convertFileSrc(filePath, protocol),
    ),
  )
}

/** True when editors render on a touch webview (the mobile app). */
export function isTouchEditorSurface(): boolean {
  return defaultPlatform().surface.touchEditor
}

/** True when the mobile surface tree is running (the mobile app). */
export function isMobileSurface(): boolean {
  return defaultPlatform().surface.mobileApp
}
