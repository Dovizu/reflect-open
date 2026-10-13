import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppServices } from '@reflect/app'
import { buildIndexedNote, parseNote } from '@reflect/core'
import {
  createTestCoreServices,
  createTestEmbeddingIndexService,
  createTestEmbeddingRuntimeService,
  createTestPlatformService,
  type TestEmbeddingIndexService,
  type TestEmbeddingRuntimeService,
} from '@reflect/core/testing'
import { deepLinkForRoute } from '@/lib/deep-links/format.ts'
import { notePathForRoute, type Route } from '@/routing/route.ts'
import type { NavigateOptions } from '@/routing/router.tsx'
import { APP_COMMANDS, keybindingFor } from './app-commands.ts'
import type { CommandContext } from './types.ts'

const TODAY = '2026-06-09'

function createApp() {
  const embeddingRuntime: TestEmbeddingRuntimeService = createTestEmbeddingRuntimeService({
    status: { status: 'uninitialized' },
  })
  const embeddingIndex: TestEmbeddingIndexService = createTestEmbeddingIndexService({
    backfill: async () => 'completed',
  })
  return createTestCoreServices({ embeddingRuntime, embeddingIndex })
}

let app: ReturnType<typeof createApp>

beforeEach(() => {
  app = createApp()
})

afterEach(() => {
  app.database.close()
})

function command(id: string) {
  const found = APP_COMMANDS.find((entry) => entry.id === id)
  if (!found) {
    throw new Error(`no such command: ${id}`)
  }
  return found
}

function fakeContext(overrides?: Partial<CommandContext>) {
  const navigated: Route[] = []
  const navigateOptions: (NavigateOptions | undefined)[] = []
  const route: () => Route = overrides?.route ?? (() => ({ kind: 'today' }))
  const context: CommandContext = {
    services: app,
    app: createAppServices(app, { operations: app.progress }),
    navigate: (target, options) => {
      navigated.push(target)
      navigateOptions.push(options)
    },
    route,
    // Mirror the real context: note-scoped commands resolve their target from
    // the route (the focused-day branch is exercised in app-shortcuts).
    notePath: () => notePathForRoute(route(), TODAY),
    back: vi.fn(),
    forward: vi.fn(),
    clearScrollState: vi.fn(),
    togglePin: vi.fn(async () => {}),
    togglePrivate: vi.fn(async () => {}),
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    newChat: vi.fn(),
    openNoteFind: vi.fn(),
    findNextInNote: vi.fn(),
    findPreviousInNote: vi.fn(),
    switchGraph: vi.fn(),
    toggleAudioMemo: vi.fn(),
    openPalette: vi.fn(),
    openShortcuts: vi.fn(),
    openTemplatePicker: vi.fn(),
    openTemplateCreate: vi.fn(),
    enableSemanticSearch: vi.fn(),
    ...overrides,
  }
  return { context, navigated, navigateOptions }
}

describe('keybindingFor', () => {
  it('returns the binding UI hints derive from', () => {
    expect(keybindingFor('nav.today')).toBe('Mod-d')
    expect(keybindingFor('nav.allNotes')).toBe('Mod-Shift-a')
    expect(keybindingFor('palette.open')).toBe('Mod-k')
  })

  it('returns null for unbound commands and unknown ids', () => {
    expect(keybindingFor('theme.toggle')).toBeNull() // a real command, no binding
    expect(keybindingFor('no.such.command')).toBeNull()
  })

  it('audioMemo.toggle is bound to Mod-Shift-r', () => {
    expect(keybindingFor('audioMemo.toggle')).toBe('Mod-Shift-r')
  })

  it('dev.toggleDevtools is bound to Mod-Shift-i', () => {
    expect(keybindingFor('dev.toggleDevtools')).toBe('Mod-Shift-i')
  })

  it('note.copyDeepLink keeps the V1 copy-link shortcut', () => {
    expect(keybindingFor('note.copyDeepLink')).toBe('Alt-Mod-l')
  })

  it('note.copyPath uses the Finder copy-as-pathname chord', () => {
    expect(keybindingFor('note.copyPath')).toBe('Alt-Mod-c')
  })

  it('note.openInNewWindow uses the system-level open-window shortcut', () => {
    expect(keybindingFor('note.openInNewWindow')).toBe('Mod-Shift-o')
  })

  it('graph switch commands use command-number bindings', () => {
    expect(keybindingFor('graph.switch1')).toBe('Mod-1')
    expect(keybindingFor('graph.switch9')).toBe('Mod-9')
  })
})

describe('app commands', () => {
  it('nav.today, history, palette, theme, and sidebar commands hit their capabilities', async () => {
    const { context, navigated, navigateOptions } = fakeContext()
    await command('nav.today').run(context)
    expect(navigated).toEqual([{ kind: 'today' }])
    // ⌘D is a capture gesture: the arrival asks the stream to focus today's
    // editor at the end of its content, ready to append.
    expect(navigateOptions).toEqual([{ focusEditor: true }])
    await command('history.back').run(context)
    expect(context.back).toHaveBeenCalled()
    await command('history.forward').run(context)
    expect(context.forward).toHaveBeenCalled()
    await command('palette.open').run(context)
    expect(context.openPalette).toHaveBeenCalled()
    await command('theme.toggle').run(context)
    expect(context.toggleTheme).toHaveBeenCalled()
    await command('sidebar.toggle').run(context)
    expect(context.toggleSidebar).toHaveBeenCalled()
    await command('audioMemo.toggle').run(context)
    expect(context.toggleAudioMemo).toHaveBeenCalled()
  })

  it('settings.open navigates to the settings screen', async () => {
    const { context, navigated } = fakeContext()
    await command('settings.open').run(context)
    expect(navigated).toEqual([{ kind: 'settings' }])
  })

  it('note Find commands use the shared window-scoped capabilities', async () => {
    const { context } = fakeContext()
    await command('note.find').run(context)
    await command('note.findNext').run(context)
    await command('note.findPrevious').run(context)

    expect(context.openNoteFind).toHaveBeenCalledTimes(1)
    expect(context.findNextInNote).toHaveBeenCalledTimes(1)
    expect(context.findPreviousInNote).toHaveBeenCalledTimes(1)
  })

  it('shortcuts.show opens the ⌘/ cheat-sheet through the context capability', async () => {
    const { context } = fakeContext()
    await command('shortcuts.show').run(context)
    expect(context.openShortcuts).toHaveBeenCalledTimes(1)
    expect(keybindingFor('shortcuts.show')).toBe('Mod-/')
  })

  it('template.insert opens the picker only where a note is being edited', async () => {
    const { context } = fakeContext({ route: () => ({ kind: 'note', path: 'notes/a.md' }) })
    await command('template.insert').run(context)
    expect(context.openTemplatePicker).toHaveBeenCalledTimes(1)

    // Settings edits no note — there is nothing to insert into.
    const { context: noNote } = fakeContext({ route: () => ({ kind: 'settings' }) })
    await command('template.insert').run(noNote)
    expect(noNote.openTemplatePicker).not.toHaveBeenCalled()
  })

  it('template.new opens the name dialog through the context capability', async () => {
    const { context } = fakeContext()
    await command('template.new').run(context)
    expect(context.openTemplateCreate).toHaveBeenCalledTimes(1)
  })

  it('chat.new starts a fresh conversation only from the chat route', async () => {
    const { context } = fakeContext({ route: () => ({ kind: 'chat' }) })
    await command('chat.new').run(context)
    expect(context.newChat).toHaveBeenCalledTimes(1)
    expect(keybindingFor('chat.new')).toBe('Mod-Shift-n')

    const { context: outsideChat } = fakeContext()
    await command('chat.new').run(outsideChat)
    expect(outsideChat.newChat).not.toHaveBeenCalled()
  })

  it('graph switch commands select their recent graph position', async () => {
    const switchGraph = vi.fn()
    const { context } = fakeContext({ switchGraph })

    await command('graph.switch1').run(context)
    await command('graph.switch9').run(context)

    expect(switchGraph).toHaveBeenNthCalledWith(1, 0)
    expect(switchGraph).toHaveBeenNthCalledWith(2, 8)
  })

  it('note.new clears daily scroll and navigates to a fresh lazy ULID note path', async () => {
    const clearScrollState = vi.fn()
    const { context, navigated } = fakeContext({ clearScrollState })
    await command('note.new').run(context)
    expect(clearScrollState).toHaveBeenCalledTimes(1)
    expect(navigated).toHaveLength(1)
    const route = navigated[0]!
    expect(route.kind).toBe('note')
    expect((route as { kind: 'note'; path: string }).path).toMatch(/^notes\/[0-9a-z]+\.md$/)
  })

  it('note.new leaves non-daily route scroll restoration intact', async () => {
    const clearScrollState = vi.fn()
    const { context } = fakeContext({
      clearScrollState,
      route: () => ({ kind: 'allNotes', tag: null }),
    })
    await command('note.new').run(context)
    expect(clearScrollState).not.toHaveBeenCalled()
  })

  it('note.openInNewWindow opens the selected note, including the focused daily note', async () => {
    const { context } = fakeContext({ route: () => ({ kind: 'note', path: 'notes/a.md' }) })
    await command('note.openInNewWindow').run(context)
    expect(app.window.openedNoteWindows()).toEqual([
      deepLinkForRoute({ kind: 'note', path: 'notes/a.md' }),
    ])

    const { context: focusedDaily } = fakeContext({
      notePath: () => 'daily/2026-06-18.md',
    })
    await command('note.openInNewWindow').run(focusedDaily)
    expect(app.window.openedNoteWindows().at(-1)).toBe(
      deepLinkForRoute({ kind: 'daily', date: '2026-06-18' }),
    )
  })

  it('note.openInNewWindow is inert on a screen with no selected note', async () => {
    const { context } = fakeContext({ route: () => ({ kind: 'settings' }) })
    await command('note.openInNewWindow').run(context)
    expect(app.window.openedNoteWindows()).toEqual([])
  })

  it('note.random navigates to the picked note and no-ops on an empty graph', async () => {
    const { context, navigated } = fakeContext()
    await command('note.random').run(context)
    expect(navigated).toEqual([])

    const source = '# Lucky\n'
    app.database.applyProjection(
      buildIndexedNote(parseNote({ path: 'notes/lucky.md', source }), {
        fileHash: 'hash',
        mtime: 1,
        source,
      }),
    )
    await command('note.random').run(context)
    expect(navigated).toEqual([{ kind: 'note', path: 'notes/lucky.md' }])
  })

  it('note.togglePin delegates to the shared pin capability', async () => {
    const { context } = fakeContext()
    await command('note.togglePin').run(context)
    expect(context.togglePin).toHaveBeenCalledOnce()
  })

  it('note.togglePrivate delegates to the shared privacy capability', async () => {
    const { context } = fakeContext()
    await command('note.togglePrivate').run(context)
    expect(context.togglePrivate).toHaveBeenCalledOnce()
  })

  it('note.copyDeepLink copies the route note through the keyboard command', async () => {
    const copyDeepLink = vi.spyOn(app.noteActions, 'copyDeepLink').mockResolvedValue()
    const { context } = fakeContext({ route: () => ({ kind: 'note', path: 'notes/a.md' }) })
    await command('note.copyDeepLink').run(context)
    expect(copyDeepLink).toHaveBeenCalledWith('notes/a.md')
  })

  it('note.copyDeepLink no-ops on note-less routes', async () => {
    const copyDeepLink = vi.spyOn(app.noteActions, 'copyDeepLink').mockResolvedValue()
    const { context } = fakeContext({ route: () => ({ kind: 'settings' }) })
    await command('note.copyDeepLink').run(context)
    expect(copyDeepLink).not.toHaveBeenCalled()
  })

  it('note.copyPath hands the route note to the service', async () => {
    const copyPath = vi.spyOn(app.noteActions, 'copyPath').mockResolvedValue()
    const { context } = fakeContext({ route: () => ({ kind: 'note', path: 'notes/a.md' }) })
    await command('note.copyPath').run(context)
    expect(copyPath).toHaveBeenCalledWith('notes/a.md')
  })

  it('note.copyPath no-ops on note-less routes', async () => {
    const copyPath = vi.spyOn(app.noteActions, 'copyPath').mockResolvedValue()
    const { context } = fakeContext({ route: () => ({ kind: 'settings' }) })
    await command('note.copyPath').run(context)
    expect(copyPath).not.toHaveBeenCalled()
  })

  it('dev.toggleDevtools toggles the inspector through the native shell', async () => {
    const { context } = fakeContext()
    await command('dev.toggleDevtools').run(context)
    expect(app.window.devtoolsToggles()).toBe(1)
  })

  it('dev.toggleDevtools no-ops without a native shell (plain-browser dev)', async () => {
    const browser = createTestCoreServices({
      platform: createTestPlatformService({ isNativeShell: false }),
    })
    const { context } = fakeContext({ services: browser })
    await expect(command('dev.toggleDevtools').run(context)).resolves.toBeUndefined()
    expect(browser.window.devtoolsToggles()).toBe(0)
    browser.database.close()
  })

  it('semantic.enable persists the opt-in through the context capability', async () => {
    const { context } = fakeContext()
    await command('semantic.enable').run(context)
    // EmbeddingsSync owns the download reaction; the command only opts in.
    expect(context.enableSemanticSearch).toHaveBeenCalled()
  })

  it('index.rebuild runs at the open generation and reports as an operation', async () => {
    app.graphSession.setGraph({ indexGeneration: 7 })
    const { context } = fakeContext()
    await command('index.rebuild').run(context)
    expect(app.indexLifecycle.rebuilds()).toEqual([7])
    expect(app.progress.started()).toMatchObject([
      { label: 'Rebuilding search index', ended: true },
    ])

    // No graph open → no rebuild.
    app.graphSession.setGraph(null)
    await command('index.rebuild').run(context)
    expect(app.indexLifecycle.rebuilds()).toEqual([7])
  })

  it('index.rebuild re-runs the embedding backfill when the model is ready', async () => {
    app.graphSession.setGraph({ indexGeneration: 7 })
    app.embeddingRuntime.setStatus({ status: 'ready', model: 'all-MiniLM-L6-v2' })
    const { context } = fakeContext()
    await command('index.rebuild').run(context)
    // index_clear wiped the embedding tables; rebuild must repopulate them.
    expect(app.embeddingIndex.backfills()).toEqual([{ generation: 7, modelId: 'all-MiniLM-L6-v2' }])
  })
})
