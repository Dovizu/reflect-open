import { defaultPlatform } from '@reflect/core'

/**
 * Whether the window draws content under a transparent macOS title bar
 * (`titleBarStyle: "Overlay"` in tauri.conf.json), with the traffic lights
 * floating over the top-left of the webview.
 *
 * True only in the macOS desktop webview: plain-browser dev, other desktop
 * platforms, and iPadOS keep their native title bars.
 *
 * Layout that must clear the title-bar zone (the top 28px, `h-7`/`pt-7`)
 * keys off this; the zone itself is claimed by `WindowDragRegion`.
 */
export function hasMacosTitleBarOverlay(): boolean {
  return defaultPlatform().hasMacosTitleBarOverlay
}
