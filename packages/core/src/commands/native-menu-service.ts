import { z } from 'zod'
import { defaultLogger, type LoggerService } from '../app/logger-service.ts'
import { defaultPlatform, type PlatformFacts } from '../app/platform-service.ts'
import { defaultWindow, MAIN_WINDOW_LABEL, type WindowService } from '../app/window-service.ts'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService, Unlisten } from '../ipc/ipc-service.ts'
import { bindingToAccelerator } from './accelerator.ts'
import { defaultCommands, type CommandService } from './command-service.ts'

/** A menu item whose behavior the operating system implements. */
export type NativeMenuPredefinedItem =
  | 'Separator'
  | 'Copy'
  | 'Cut'
  | 'Paste'
  | 'SelectAll'
  | 'Undo'
  | 'Redo'
  | 'Minimize'
  | 'Maximize'
  | 'Fullscreen'
  | 'Hide'
  | 'HideOthers'
  | 'ShowAll'
  | 'CloseWindow'
  | 'Quit'
  | 'Services'
  | 'BringAllToFront'
  | { About: null }

export type AppMenuEntry =
  | { kind: 'command'; commandId: string; text?: string | undefined }
  | { kind: 'predefined'; item: NativeMenuPredefinedItem; text?: string | undefined }

export interface AppSubmenuLayout {
  text: string
  /**
   * macOS NSApp role: `windows` gains the automatic window list,
   * `help` gains the Search field.
   */
  nsAppRole?: 'windows' | 'help'
  entries: AppMenuEntry[]
}

/** One item of a submenu, as a {@link NativeMenuHost} builds it. */
export type NativeMenuItem =
  | {
      kind: 'command'
      id: string
      text: string
      accelerator?: string
      /** Invoked with the item id when the item is activated. */
      action: (id: string) => void
    }
  | { kind: 'predefined'; item: NativeMenuPredefinedItem; text?: string }

export interface NativeSubmenu {
  text: string
  nsAppRole?: 'windows' | 'help'
  items: NativeMenuItem[]
}

/** An application menu that a {@link NativeMenuHost} built but has not installed yet. */
export interface NativeAppMenu {
  /** Install the menu as the application menu, replacing the current one. */
  setAsAppMenu(): Promise<void>
  /** Give each submenu its `nsAppRole`. Call it after {@link setAsAppMenu}. */
  assignNsAppRoles(): Promise<void>
}

export interface NativeContextMenuItem {
  /** Visible native menu item label. */
  text: string
  /** Invoked when the native menu item is selected. */
  action: () => void
}

export interface NativeContextMenuOptions {
  /** Menu items to render in order. */
  items: readonly NativeContextMenuItem[]
}

/** The native menu operations behind a {@link NativeMenuService}. */
export interface NativeMenuHost {
  buildAppMenu(submenus: readonly NativeSubmenu[]): Promise<NativeAppMenu>
  /** Open a context menu at the pointer. */
  popup(items: readonly NativeContextMenuItem[]): Promise<void>
}

/** A host without native menus: every operation rejects. */
export function createUnsupportedNativeMenuHost(): NativeMenuHost {
  const unsupported = async (): Promise<never> =>
    await Promise.reject(new Error('native menus are not supported on this host'))
  return { buildAppMenu: unsupported, popup: unsupported }
}

export type MenuCommandDispatch = (commandId: string) => void

const FocusedNoteMenuCommandSchema = z.enum(['note.find', 'note.findNext', 'note.findPrevious'])

/** Native menu commands whose target is the focused note webview. */
export type FocusedNoteMenuCommand = z.infer<typeof FocusedNoteMenuCommandSchema>

const FOCUSED_NOTE_MENU_EVENT = 'reflect://focused-note-menu-command'

/**
 * The native macOS application menu and native context menus. Command items
 * derive from the command registry — id, label, and accelerator come from the
 * one command definition — so the menu cannot drift from the bindings that
 * fire.
 *
 * The menu is built once at startup, before the UI mounts, so item
 * activations go to {@link NativeMenuService.dispatchCommand} and from there
 * to the dispatcher that the mounted workspace published. While no dispatcher
 * is set, menu items are inert.
 */
export interface NativeMenuService {
  /**
   * Build the application menu from `layout` and install it, replacing the
   * host's default. Call once at startup — the menu holds command ids, not
   * state, so it never needs rebuilding.
   *
   * macOS-only, and only in the main window: menu actions use channels owned
   * by the webview that created them, so a note window must not replace the
   * app-wide menu with an inert copy.
   */
  install(layout: readonly AppSubmenuLayout[]): Promise<void>
  /** Whether this webview has successfully installed the native app menu. */
  isInstalled(): boolean
  /** Publish (or with `null`, withdraw) the active menu-command dispatcher. */
  setCommandDispatch(dispatch: MenuCommandDispatch | null): void
  /**
   * Forward a native menu activation to the focused webview. Find commands are
   * note-window-local; all other commands go to the published dispatcher. A
   * function property: menu items hold it as their detached action.
   */
  dispatchCommand: (commandId: string) => void
  /** Listen for native Find menu commands routed to this focused note window. */
  subscribeFocusedNoteCommands(listener: (commandId: FocusedNoteMenuCommand) => void): Unlisten
  /**
   * Open a native context menu. Outside a native shell, this is a no-op so
   * browser and test shells can call the same path without platform guards.
   */
  openContextMenu(options: NativeContextMenuOptions): Promise<void>
}

export interface NativeMenuServiceDeps {
  commands: Pick<CommandService, 'list'>
  window: Pick<
    WindowService,
    'isMainWindow' | 'focusedWindowLabel' | 'emitTo' | 'subscribeWindowEvent'
  >
  platform: Pick<PlatformFacts, 'isMacosDesktop' | 'isNativeShell'>
  ipc: Pick<IpcBridgeService, 'call'>
  logger: LoggerService
  host: NativeMenuHost
}

export function createNativeMenuService(deps: NativeMenuServiceDeps): NativeMenuService {
  const { commands, window, platform, ipc, logger, host } = deps
  let installed = false
  let current: MenuCommandDispatch | null = null

  async function dispatchToFocusedWindow(commandId: FocusedNoteMenuCommand): Promise<void> {
    let focusedLabel: string | null = null
    try {
      focusedLabel = await window.focusedWindowLabel()
    } catch (cause) {
      logger.error('focused window lookup failed:', cause)
      return
    }

    if (focusedLabel === null) {
      // A menu activation can briefly leave macOS without a focused webview.
      // Never guess `main`: acting on the wrong note is worse than leaving this
      // one activation inert.
      return
    }

    if (focusedLabel !== MAIN_WINDOW_LABEL) {
      try {
        await window.emitTo(focusedLabel, FOCUSED_NOTE_MENU_EVENT, commandId)
      } catch (cause) {
        // Never fall through to the main note: the command belongs to the
        // focused detached window, even if its event channel just disappeared.
        logger.error('focused note menu dispatch failed:', cause)
      }
      return
    }
    current?.(commandId)
  }

  function dispatchCommand(commandId: string): void {
    const focusedNoteCommand = FocusedNoteMenuCommandSchema.safeParse(commandId)
    if (platform.isNativeShell && focusedNoteCommand.success) {
      void dispatchToFocusedWindow(focusedNoteCommand.data)
      return
    }
    current?.(commandId)
  }

  function menuItem(entry: AppMenuEntry): NativeMenuItem {
    if (entry.kind === 'predefined') {
      return {
        kind: 'predefined',
        item: entry.item,
        ...(entry.text !== undefined ? { text: entry.text } : {}),
      }
    }
    const command = commands.list().find((candidate) => candidate.id === entry.commandId)
    if (!command) {
      throw new Error(`native menu references unknown command: ${entry.commandId}`)
    }
    const accelerator = command.keybinding ? bindingToAccelerator(command.keybinding) : undefined
    return {
      kind: 'command',
      id: command.id,
      text: entry.text ?? command.title,
      ...(accelerator !== undefined ? { accelerator } : {}),
      action: dispatchCommand,
    }
  }

  return {
    async install(layout) {
      if (!platform.isMacosDesktop || !window.isMainWindow()) {
        return
      }
      const menu = await host.buildAppMenu(
        layout.map((submenu) => ({
          text: submenu.text,
          ...(submenu.nsAppRole !== undefined ? { nsAppRole: submenu.nsAppRole } : {}),
          items: submenu.entries.map(menuItem),
        })),
      )
      await menu.setAsAppMenu()
      installed = true
      // NSApp roles must be assigned after setAsAppMenu: attaching the menu
      // clones each submenu's NSMenu, and muda resolves the role against the
      // instance inside the installed main menu — assigned earlier, the role
      // silently no-ops and macOS never adds its automatic items (the window
      // list and Move & Resize/tiling with their system shortcuts; Help search).
      await menu.assignNsAppRoles()
      // Must run after setAsAppMenu, like the role assignment above: it adds the
      // Edit > "Paste and Match Style" (⌘⇧V) item to the menu that was just
      // installed. The menu API cannot create that item (it needs a native macOS
      // action selector), so a Rust command does it with direct AppKit calls;
      // see `src-tauri/src/menu.rs` for the full explanation with source links.
      // Best-effort: the menu works without the item, so a failed call must
      // not make the whole install look failed.
      try {
        await ipc.call('menu_install_paste_and_match_style', {}, z.null())
      } catch (error) {
        logger.warn('failed to add the Paste and Match Style menu item:', error)
      }
    },
    isInstalled: () => installed,
    setCommandDispatch(dispatch) {
      current = dispatch
    },
    dispatchCommand,
    subscribeFocusedNoteCommands: (listener) =>
      window.subscribeWindowEvent(FOCUSED_NOTE_MENU_EVENT, (payload) => {
        const command = FocusedNoteMenuCommandSchema.safeParse(payload)
        if (command.success) {
          listener(command.data)
        }
      }),
    async openContextMenu(options) {
      if (!platform.isNativeShell) {
        return
      }
      await host.popup(options.items)
    },
  }
}

let installedService: NativeMenuService | null = null
let fallback: NativeMenuService | null = null

/**
 * The process-wide `NativeMenuService`. Unless one is installed, it runs over
 * the current default command, window, platform, IPC, and logger services,
 * read on every call, and a host without native menus.
 */
export function defaultNativeMenu(): NativeMenuService {
  if (installedService !== null) {
    return installedService
  }
  fallback ??= createNativeMenuService({
    // Resolved per call: each of these may be installed later.
    commands: { list: () => defaultCommands().list() },
    window: {
      isMainWindow: () => defaultWindow().isMainWindow(),
      focusedWindowLabel: async () => await defaultWindow().focusedWindowLabel(),
      emitTo: async (label, event, payload) => {
        await defaultWindow().emitTo(label, event, payload)
      },
      subscribeWindowEvent: (event, listener) =>
        defaultWindow().subscribeWindowEvent(event, listener),
    },
    platform: {
      get isMacosDesktop() {
        return defaultPlatform().isMacosDesktop
      },
      get isNativeShell() {
        return defaultPlatform().isNativeShell
      },
    },
    ipc: currentIpc(),
    logger: {
      error: (...args) => defaultLogger().error(...args),
      warn: (...args) => defaultLogger().warn(...args),
      info: (...args) => defaultLogger().info(...args),
    },
    host: createUnsupportedNativeMenuHost(),
  })
  return fallback
}

/** Install the process-wide `NativeMenuService`; `null` restores the fallback. */
export function setDefaultNativeMenu(service: NativeMenuService | null): void {
  installedService = service
}
