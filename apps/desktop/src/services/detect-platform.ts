import type { AppPlatform, PlatformFacts } from '@reflect/core'

function envPlatform(env: string): AppPlatform {
  switch (env) {
    case 'ios':
      return 'ios'
    case 'android':
      return 'android'
    case 'windows':
    case 'linux':
    case 'darwin':
    case '':
      return 'desktop'
    default:
      console.warn('[reflect-open] Unknown environment variable TAURI_ENV_PLATFORM:', env)
      return 'desktop'
  }
}

// Plain-browser dev (no Tauri build target) may pick a UI family with `?platform=`.
function devPlatformOverride(env: string): AppPlatform | null {
  if (env || !import.meta.env.DEV || typeof window === 'undefined') {
    return null
  }
  const query = new URLSearchParams(window.location.search).get('platform')
  switch (query) {
    case 'ios':
      return 'ios'
    case 'android':
      return 'android'
    case 'desktop':
      return 'desktop'
  }
  if (query) {
    console.warn('[reflect-open] Unknown platform override in query string:', query)
  }
  return null
}

/**
 * Detect the host's platform facts from the user agent and the build env.
 * `nativeShell` is Tauri's `isTauri()`, passed in so this module stays free of Tauri imports.
 */
export function detectPlatformFacts(nativeShell: boolean): PlatformFacts {
  const env = import.meta.env.TAURI_ENV_PLATFORM || ''
  const hasNavigator = typeof navigator !== 'undefined'
  // iPadOS masquerades as macOS in the user agent; the touch-point check excludes it.
  const macosDesktop =
    nativeShell &&
    hasNavigator &&
    navigator.userAgent.includes('Macintosh') &&
    navigator.maxTouchPoints === 0

  return {
    appPlatform: devPlatformOverride(env) ?? envPlatform(env),
    isNativeShell: nativeShell,
    isMacosDesktop: macosDesktop,
    isApplePlatform:
      hasNavigator && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    hasMacosTitleBarOverlay: macosDesktop,
    surface: { touchEditor: false, mobileApp: false },
    isDev: import.meta.env.DEV,
    appVersion: __REFLECT_VERSION__,
  }
}
