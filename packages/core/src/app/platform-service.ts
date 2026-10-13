import type { AppPlatform } from './platform.ts'

/**
 * The Tauri build targets the app ships for.
 */
export type BuildPlatform = 'darwin' | 'windows' | 'linux' | 'ios' | 'android'

export type ColorScheme = 'light' | 'dark'

/**
 * How the running surface differs from stock desktop.
 */
export interface PlatformSurface {
  /**
   * Editors apply touch text-input hygiene (the mobile app).
   */
  readonly touchEditor: boolean
  /**
   * Shared components render their mobile variants (the mobile app).
   */
  readonly mobileApp: boolean
}

/**
 * What the host is and can do, decided once by the app at startup.
 */
export interface PlatformFacts {
  /**
   * Which UI family the app runs.
   */
  readonly appPlatform: AppPlatform
  /**
   * A real native shell (plugins, OS windows) exists; false in browser dev.
   */
  readonly isNativeShell: boolean
  /**
   * The Tauri build target; null outside a Tauri build.
   */
  readonly buildPlatform: BuildPlatform | null
  /**
   * The macOS desktop shell (not iPadOS, not browser dev).
   */
  readonly isMacosDesktop: boolean
  /**
   * Mod renders as ⌘ rather than Ctrl.
   */
  readonly isApplePlatform: boolean
  /**
   * The window draws content under a transparent macOS title bar.
   */
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

/**
 * Maps a file path to the webview URL serving it through a custom URI scheme.
 */
export type FileSrcConverter = (filePath: string, protocol: string) => string

/**
 * The custom-scheme URL shape Tauri uses on macOS and iOS.
 */
export function appleFileSrc(filePath: string, protocol: string): string {
  return `${protocol}://localhost/${encodeURIComponent(filePath)}`
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export interface PlatformServiceDeps {
  readonly facts: PlatformFacts
  readonly media?: PlatformMedia | undefined
  readonly fileSrc?: FileSrcConverter | undefined
}

class PlatformServiceImpl implements PlatformService {
  readonly #media: PlatformMedia | undefined
  readonly #toFileSrc: FileSrcConverter

  readonly appPlatform: AppPlatform
  readonly isNativeShell: boolean
  readonly buildPlatform: BuildPlatform | null
  readonly isMacosDesktop: boolean
  readonly isApplePlatform: boolean
  readonly hasMacosTitleBarOverlay: boolean
  readonly surface: PlatformSurface
  readonly isDev: boolean
  readonly appVersion: string

  constructor(deps: PlatformServiceDeps) {
    const { facts, media, fileSrc } = deps
    this.#media = media
    this.#toFileSrc = fileSrc ?? appleFileSrc
    this.appPlatform = facts.appPlatform
    this.isNativeShell = facts.isNativeShell
    this.buildPlatform = facts.buildPlatform
    this.isMacosDesktop = facts.isMacosDesktop
    this.isApplePlatform = facts.isApplePlatform
    this.hasMacosTitleBarOverlay = facts.hasMacosTitleBarOverlay
    this.surface = { touchEditor: facts.surface.touchEditor, mobileApp: facts.surface.mobileApp }
    this.isDev = facts.isDev
    this.appVersion = facts.appVersion
  }

  convertFileSrc(filePath: string, protocol: string): string {
    return this.#toFileSrc(filePath, protocol)
  }

  prefersReducedMotion(): boolean {
    return this.#matches(REDUCED_MOTION_QUERY)
  }

  subscribeReducedMotion(listener: (value: boolean) => void): () => void {
    return this.#subscribe(REDUCED_MOTION_QUERY, listener)
  }

  colorScheme(): ColorScheme {
    return this.#matches(DARK_QUERY) ? 'dark' : 'light'
  }

  subscribeColorScheme(listener: (value: ColorScheme) => void): () => void {
    return this.#subscribe(DARK_QUERY, (dark) => listener(dark ? 'dark' : 'light'))
  }

  // Resolved per call: the global `matchMedia` may be replaced after construction.
  #resolveMatchMedia(): ((query: string) => MediaQueryList) | undefined {
    if (this.#media) {
      return this.#media.matchMedia
    }
    if (typeof globalThis.matchMedia !== 'function') {
      return undefined
    }
    return (query) => globalThis.matchMedia(query)
  }

  #matches(query: string): boolean {
    const matchMedia = this.#resolveMatchMedia()
    return matchMedia !== undefined && matchMedia(query).matches
  }

  #subscribe(query: string, onChange: (matches: boolean) => void): () => void {
    const matchMedia = this.#resolveMatchMedia()
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
}

export function createPlatformService(deps: PlatformServiceDeps): PlatformService {
  return new PlatformServiceImpl(deps)
}
