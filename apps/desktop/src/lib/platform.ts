import { defaultPlatform } from '@reflect/core'

/**
 * True in a real Tauri webview — plugins, custom URL schemes, and real OS
 * windows are reachable. NOT satisfied by the in-browser dev bridge, which
 * answers IPC commands without any of those. Gates that mean "the native
 * shell exists" use this.
 */
export function isNativeShell(): boolean {
  return defaultPlatform().isNativeShell
}

/**
 * True in the macOS desktop webview — the platform gate for macOS-only
 * capabilities (EventKit calendar access). Plain-browser dev, other desktop
 * platforms, and iPadOS are excluded.
 */
export function isMacosDesktop(): boolean {
  return defaultPlatform().isMacosDesktop
}
