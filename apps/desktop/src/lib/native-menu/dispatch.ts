import {
  defaultNativeMenu,
  type FocusedNoteMenuCommand,
  type MenuCommandDispatch,
  type Unlisten,
} from '@reflect/core'

/**
 * Native menu → command registry hand-off. The menu is built once at startup,
 * before React mounts, so item activations land here and are forwarded to
 * whichever mounted workspace currently owns the {@link import('@/lib/commands/types.ts').CommandContext}.
 *
 * `useAppShortcuts` publishes its dispatcher on mount and clears it on
 * unmount. While no dispatcher is set (the moments before first mount, or
 * screens without a workspace) menu items are inert — there is nothing for a
 * command to act on, which is the same answer the keydown path gives there.
 */

export type { FocusedNoteMenuCommand }

/** Publish (or with `null`, withdraw) the active menu-command dispatcher. */
export function setMenuCommandDispatch(dispatch: MenuCommandDispatch | null): void {
  defaultNativeMenu().setCommandDispatch(dispatch)
}

/**
 * Forward a native menu activation to the focused webview. Find commands are
 * note-window-local; all other commands retain the main workspace dispatcher.
 */
export function dispatchMenuCommand(commandId: string): void {
  defaultNativeMenu().dispatchCommand(commandId)
}

/** Listen for native Find menu commands routed to this focused note window. */
export function listenForFocusedNoteMenuCommands(
  dispatch: (commandId: FocusedNoteMenuCommand) => void,
): Unlisten {
  return defaultNativeMenu().subscribeFocusedNoteCommands(dispatch)
}
