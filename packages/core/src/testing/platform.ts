import type {
  ColorScheme,
  PlatformFacts,
  PlatformService,
  PlatformSurface,
} from '../app/platform-service.ts'

export interface TestPlatformOptions extends Partial<Omit<PlatformFacts, 'surface'>> {
  surface?: Partial<PlatformSurface>
  reducedMotion?: boolean
  colorScheme?: ColorScheme
}

export interface TestPlatformService extends PlatformService {
  /** Change the reduced-motion preference and notify subscribers. */
  setReducedMotion(value: boolean): void
  /** Change the color scheme and notify subscribers. */
  setColorScheme(value: ColorScheme): void
}

/** A platform service with fixed facts; defaults to a macOS desktop native shell. */
export function createTestPlatformService(options: TestPlatformOptions = {}): TestPlatformService {
  let reducedMotion = options.reducedMotion ?? false
  let colorScheme = options.colorScheme ?? 'light'
  const reducedMotionListeners = new Set<(value: boolean) => void>()
  const colorSchemeListeners = new Set<(value: ColorScheme) => void>()

  return {
    appPlatform: options.appPlatform ?? 'desktop',
    isNativeShell: options.isNativeShell ?? true,
    isMacosDesktop: options.isMacosDesktop ?? true,
    isApplePlatform: options.isApplePlatform ?? true,
    hasMacosTitleBarOverlay: options.hasMacosTitleBarOverlay ?? true,
    surface: {
      touchEditor: options.surface?.touchEditor ?? false,
      mobileApp: options.surface?.mobileApp ?? false,
    },
    isDev: options.isDev ?? false,
    appVersion: options.appVersion ?? '0.0.0-test',
    prefersReducedMotion: () => reducedMotion,
    subscribeReducedMotion(listener) {
      reducedMotionListeners.add(listener)
      return () => reducedMotionListeners.delete(listener)
    },
    colorScheme: () => colorScheme,
    subscribeColorScheme(listener) {
      colorSchemeListeners.add(listener)
      return () => colorSchemeListeners.delete(listener)
    },
    setReducedMotion(value) {
      if (value === reducedMotion) {
        return
      }
      reducedMotion = value
      for (const listener of reducedMotionListeners) {
        listener(value)
      }
    },
    setColorScheme(value) {
      if (value === colorScheme) {
        return
      }
      colorScheme = value
      for (const listener of colorSchemeListeners) {
        listener(value)
      }
    },
  }
}
