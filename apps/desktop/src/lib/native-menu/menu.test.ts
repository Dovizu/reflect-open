import { isNotNullish } from '@ocavue/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultWindow } from '@reflect/core'
import { createTestWindowService, type TestWindowService } from '@reflect/core/testing'

interface MenuItemOptionsForTest {
  readonly id?: string
  readonly text?: string
  readonly accelerator?: string
  readonly action?: (commandId: string) => void
}

interface SubmenuOptionsForTest {
  readonly text: string
  readonly items: readonly MenuItemOptionsForTest[]
}

const isTauri = vi.hoisted(() => vi.fn(() => true))
const invoke = vi.hoisted(() => vi.fn(async () => undefined))
const isMainWindow = vi.hoisted(() => vi.fn(() => true))
const setAsAppMenu = vi.hoisted(() => vi.fn(async () => null))
const setAsWindowsMenuForNSApp = vi.hoisted(() => vi.fn(async () => {}))
const setAsHelpMenuForNSApp = vi.hoisted(() => vi.fn(async () => {}))
const submenuNew = vi.hoisted(() =>
  vi.fn(async (_options: SubmenuOptionsForTest) => ({
    setAsWindowsMenuForNSApp,
    setAsHelpMenuForNSApp,
  })),
)
const menuNew = vi.hoisted(() => vi.fn(async () => ({ setAsAppMenu })))
const menuItemNew = vi.hoisted(() => vi.fn(async (options: MenuItemOptionsForTest) => options))

vi.mock('@tauri-apps/api/core', () => ({ isTauri, invoke }))
vi.mock('@tauri-apps/api/menu', () => ({
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
  Submenu: { new: submenuNew },
}))
vi.mock('@/lib/windows/window-role.ts', () => ({ isMainWindow }))

const { APP_COMMANDS, keybindingFor } = await import('@/lib/commands/app-commands.ts')
const { dispatchMenuCommand, listenForFocusedNoteMenuCommands, setMenuCommandDispatch } =
  await import('./dispatch.ts')
const { appMenuLayout, installNativeMenu, isNativeMenuInstalled } = await import('./menu.ts')

let windows: TestWindowService

beforeEach(() => {
  vi.stubGlobal('navigator', { userAgent: 'Macintosh', maxTouchPoints: 0 })
  isTauri.mockReset().mockReturnValue(true)
  isMainWindow.mockReset().mockReturnValue(true)
  submenuNew.mockClear()
  menuNew.mockClear()
  menuItemNew.mockClear()
  setAsAppMenu.mockClear()
  setAsWindowsMenuForNSApp.mockClear()
  setAsHelpMenuForNSApp.mockClear()
  invoke.mockClear()
  windows = createTestWindowService()
  setDefaultWindow(windows)
})

afterEach(() => {
  setMenuCommandDispatch(null)
  vi.unstubAllGlobals()
})

function referencedCommandIds(): string[] {
  return appMenuLayout().flatMap((submenu) =>
    submenu.entries
      .map((entry) => (entry.kind === 'command' ? entry.commandId : null))
      .filter(isNotNullish),
  )
}

describe('appMenuLayout', () => {
  it('references only registered command ids', () => {
    const known = new Set(APP_COMMANDS.map((appCommand) => appCommand.id))
    const referenced = referencedCommandIds()
    expect(referenced.length).toBeGreaterThan(0)
    for (const commandId of referenced) {
      expect(known).toContain(commandId)
    }
  })

  it('surfaces every ported V1 menu shortcut', () => {
    const referenced = new Set(referencedCommandIds())
    // The V1 Electron menu items that have a V2 command: Preferences ⌘,
    // New Note ⌘N, Search ⌘K, Select Daily Note ⌘D, All Notes ⌘⇧A,
    // Back ⌘[, Forward ⌘], Open Shortcuts ⌘/.
    for (const commandId of [
      'settings.open',
      'note.new',
      'palette.open',
      'nav.today',
      'nav.allNotes',
      'history.back',
      'history.forward',
      'shortcuts.show',
    ]) {
      expect(referenced).toContain(commandId)
    }
    expect(keybindingFor('nav.allNotes')).toBe('Mod-Shift-a')
  })

  it('lists each command at most once across the whole menu', () => {
    const referenced = referencedCommandIds()
    expect(new Set(referenced).size).toBe(referenced.length)
  })

  it('exposes the selected note’s new-window shortcut in the native Window menu', () => {
    const windowMenu = appMenuLayout().find((submenu) => submenu.text === 'Window')
    expect(windowMenu?.entries).toContainEqual({
      kind: 'command',
      commandId: 'note.openInNewWindow',
      text: undefined,
    })
    expect(keybindingFor('note.openInNewWindow')).toBe('Mod-Shift-o')
  })
  it('puts note Find commands and their browser-standard shortcuts in Edit', () => {
    const editMenu = appMenuLayout().find((submenu) => submenu.text === 'Edit')
    expect(editMenu?.entries).toEqual(
      expect.arrayContaining([
        { kind: 'command', commandId: 'note.find', text: undefined },
        { kind: 'command', commandId: 'note.findNext', text: undefined },
        { kind: 'command', commandId: 'note.findPrevious', text: undefined },
      ]),
    )
    expect(keybindingFor('note.find')).toBe('Mod-f')
    expect(keybindingFor('note.findNext')).toBe('Mod-g')
    expect(keybindingFor('note.findPrevious')).toBe('Mod-Shift-g')
  })
})

describe('installNativeMenu', () => {
  it(String.raw`installs sidebar.toggle as a native Command+\ menu accelerator`, async () => {
    const dispatch = vi.fn()
    setMenuCommandDispatch(dispatch)

    await installNativeMenu()

    const viewMenu = submenuNew.mock.calls
      .map(([options]) => options)
      .find((options) => options.text === 'View')
    const sidebarToggle = viewMenu?.items.find((item) => item.id === 'sidebar.toggle')

    expect(sidebarToggle).toMatchObject({
      id: 'sidebar.toggle',
      text: 'Toggle sidebar',
      accelerator: 'CmdOrCtrl+\\',
    })
    expect(menuItemNew).toHaveBeenCalledWith(sidebarToggle)
    expect(sidebarToggle?.action).toBeTypeOf('function')
    sidebarToggle?.action?.('sidebar.toggle')
    expect(dispatch).toHaveBeenCalledWith('sidebar.toggle')
    expect(menuNew).toHaveBeenCalledTimes(1)
    expect(setAsAppMenu).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledExactlyOnceWith('menu_install_paste_and_match_style')
    // The item lands in the installed menu, so the command must run after
    // setAsAppMenu and the NSApp role assignments (menu.ts explains why).
    const firstCall = (mocked: { mock: { invocationCallOrder: number[] } }) =>
      mocked.mock.invocationCallOrder[0] ?? Infinity
    expect(firstCall(invoke)).toBeGreaterThan(firstCall(setAsAppMenu))
    expect(firstCall(invoke)).toBeGreaterThan(firstCall(setAsWindowsMenuForNSApp))
    expect(firstCall(invoke)).toBeGreaterThan(firstCall(setAsHelpMenuForNSApp))
    expect(isNativeMenuInstalled()).toBe(true)
  })

  it('leaves the main window’s app-wide menu intact when a note window boots', async () => {
    isMainWindow.mockReturnValue(false)

    await installNativeMenu()

    expect(isMainWindow).toHaveBeenCalledTimes(1)
    expect(submenuNew).not.toHaveBeenCalled()
    expect(menuNew).not.toHaveBeenCalled()
  })
})

describe('focused note menu dispatch', () => {
  const event = 'reflect://focused-note-menu-command'

  it('routes Find menu actions to the focused secondary note window', async () => {
    const dispatch = vi.fn()
    setMenuCommandDispatch(dispatch)
    windows.setFocusedWindowLabel('note-1')

    dispatchMenuCommand('note.find')

    await vi.waitFor(() => {
      expect(windows.emitted()).toEqual([{ label: 'note-1', event, payload: 'note.find' }])
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('runs Find menu actions in the main window when it has focus', async () => {
    const dispatch = vi.fn()
    setMenuCommandDispatch(dispatch)

    dispatchMenuCommand('note.findNext')

    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledWith('note.findNext'))
    expect(windows.emitted()).toEqual([])
  })

  it('does not guess the main note when no webview is focused', async () => {
    const dispatch = vi.fn()
    setMenuCommandDispatch(dispatch)
    windows.setFocusedWindowLabel(null)
    const focusedWindowLabel = vi.spyOn(windows, 'focusedWindowLabel')

    dispatchMenuCommand('note.find')

    await vi.waitFor(() => expect(focusedWindowLabel).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(windows.emitted()).toEqual([])
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('validates routed Find menu event payloads before dispatching them', () => {
    const dispatch = vi.fn()
    const unlisten = listenForFocusedNoteMenuCommands(dispatch)

    windows.emitWindowEvent(event, 'note.findNext')
    windows.emitWindowEvent(event, { command: 'note.findNext' })
    unlisten()
    windows.emitWindowEvent(event, 'note.find')

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith('note.findNext')
  })
})
