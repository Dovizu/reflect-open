import { defaultNativeMenu, type NativeContextMenuOptions } from '@reflect/core'

/**
 * Open a Tauri native context menu. Outside Tauri, this is a no-op so browser
 * and test shells can call the same path without platform guards.
 */
export async function openNativeContextMenu(options: NativeContextMenuOptions): Promise<void> {
  await defaultNativeMenu().openContextMenu(options)
}
