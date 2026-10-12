import type { AppPlatform } from './platform.ts'

export type ColorScheme = 'light' | 'dark'

/** How the running surface differs from stock desktop. */
export interface PlatformSurface {
  /** Editors apply touch text-input hygiene (the mobile app). */
  readonly touchEditor: boolean
  /** Shared components render their mobile variants (the mobile app). */
  readonly mobileApp: boolean
}

/** What the host is and can do, decided once by the app at startup. */
export interface PlatformFacts {
  /** Which UI family the app runs. */
  readonly appPlatform: AppPlatform
  /** A real native shell (plugins, OS windows) exists; false in browser dev. */
  readonly isNativeShell: boolean
  /** The macOS desktop shell (not iPadOS, not browser dev). */
  readonly isMacosDesktop: boolean
  /** Mod renders as ⌘ rather than Ctrl. */
  readonly isApplePlatform: boolean
  /** The window draws content under a transparent macOS title bar. */
  readonly hasMacosTitleBarOverlay: boolean
  readonly surface: PlatformSurface
  readonly isDev: boolean
  readonly appVersion: string
}

export interface PlatformService extends PlatformFacts {
  /**
   * The webview URL that serves `filePath` through the custom URI scheme
   * `protocol`, such as `reflect-asset`.
   */
  convertFileSrc(filePath: string, protocol: string): string
  prefersReducedMotion(): boolean
  subscribeReducedMotion(listener: (value: boolean) => void): () => void
  colorScheme(): ColorScheme
  subscribeColorScheme(listener: (value: ColorScheme) => void): () => void
}

export interface PlatformMedia {
  readonly matchMedia?: (query: string) => MediaQueryList
}

/** Maps a file path to the webview URL serving it through a custom URI scheme. */
export type FileSrcConverter = (filePath: string, protocol: string) => string

/** The custom-scheme URL shape Tauri uses on macOS and iOS. */
export function appleFileSrc(filePath: string, protocol: string): string {
  return `${protocol}://localhost/${encodeURIComponent(filePath)}`
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function createPlatformService(
  facts: PlatformFacts,
  media?: PlatformMedia,
  fileSrc?: FileSrcConverter,
): PlatformService {
  const toFileSrc = fileSrc ?? appleFileSrc
  // Resolved per call: the global `matchMedia` may be replaced after construction.
  function resolveMatchMedia(): ((query: string) => MediaQueryList) | undefined {
    if (media) {
      return media.matchMedia
    }
    if (typeof globalThis.matchMedia !== 'function') {
      return undefined
    }
    return (query) => globalThis.matchMedia(query)
  }

  function matches(query: string): boolean {
    const matchMedia = resolveMatchMedia()
    return matchMedia !== undefined && matchMedia(query).matches
  }

  function subscribe(query: string, onChange: (matches: boolean) => void): () => void {
    const matchMedia = resolveMatchMedia()
    if (matchMedia === undefined) {
      return () => {}
    }
    const list = matchMedia(query)
    const handler = (event: MediaQueryListEvent): void => onChange(event.matches)
    // Older WebKit exposes only the deprecated listener API.
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', handler)
      return () => list.removeEventListener('change', handler)
    }
    list.addListener(handler)
    return () => list.removeListener(handler)
  }

  return {
    appPlatform: facts.appPlatform,
    isNativeShell: facts.isNativeShell,
    isMacosDesktop: facts.isMacosDesktop,
    isApplePlatform: facts.isApplePlatform,
    hasMacosTitleBarOverlay: facts.hasMacosTitleBarOverlay,
    surface: { touchEditor: facts.surface.touchEditor, mobileApp: facts.surface.mobileApp },
    isDev: facts.isDev,
    appVersion: facts.appVersion,
    convertFileSrc: (filePath, protocol) => toFileSrc(filePath, protocol),
    prefersReducedMotion: () => matches(REDUCED_MOTION_QUERY),
    subscribeReducedMotion: (listener) => subscribe(REDUCED_MOTION_QUERY, listener),
    colorScheme: () => (matches(DARK_QUERY) ? 'dark' : 'light'),
    subscribeColorScheme: (listener) =>
      subscribe(DARK_QUERY, (dark) => listener(dark ? 'dark' : 'light')),
  }
}

/** The facts of `platform` as plain data. */
export function platformFacts(platform: PlatformFacts): PlatformFacts {
  return {
    appPlatform: platform.appPlatform,
    isNativeShell: platform.isNativeShell,
    isMacosDesktop: platform.isMacosDesktop,
    isApplePlatform: platform.isApplePlatform,
    hasMacosTitleBarOverlay: platform.hasMacosTitleBarOverlay,
    surface: { touchEditor: platform.surface.touchEditor, mobileApp: platform.surface.mobileApp },
    isDev: platform.isDev,
    appVersion: platform.appVersion,
  }
}

const NEUTRAL_FACTS: PlatformFacts = {
  appPlatform: 'desktop',
  isNativeShell: false,
  isMacosDesktop: false,
  isApplePlatform: false,
  hasMacosTitleBarOverlay: false,
  surface: { touchEditor: false, mobileApp: false },
  isDev: false,
  appVersion: '',
}

let installed: PlatformService | null = null
let neutral: PlatformService | null = null

/**
 * The process-wide platform: the one installed by {@link setDefaultPlatform},
 * or a neutral non-native desktop until then.
 */
export function defaultPlatform(): PlatformService {
  if (installed) {
    return installed
  }
  neutral ??= createPlatformService(NEUTRAL_FACTS)
  return neutral
}

/** Install the process-wide platform; `null` restores the neutral default. */
export function setDefaultPlatform(platform: PlatformService | null): void {
  installed = platform
}
