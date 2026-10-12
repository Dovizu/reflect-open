import { describe, expect, it, vi } from 'vitest'
import { createTestLoggerService } from './logger.ts'
import {
  createTestClipboardService,
  createTestDialogService,
  createTestLifecycleService,
  createTestOpenerService,
  createTestPathService,
  createTestWindowService,
} from './shell.ts'

describe('createTestDialogService', () => {
  it('answers pickers with preset paths and records the calls', async () => {
    const dialog = createTestDialogService({ files: ['/a.png'] })
    await expect(dialog.pickFiles({ multiple: true, title: 'Attach' })).resolves.toEqual(['/a.png'])
    await expect(dialog.pickFolder({ title: 'Choose' })).resolves.toBeNull()

    dialog.setFiles(null)
    dialog.setFolder('/g')
    await expect(dialog.pickFiles({ multiple: false, title: 'Import' })).resolves.toBeNull()
    await expect(dialog.pickFolder({ title: 'Choose', defaultPath: '/home' })).resolves.toBe('/g')

    expect(dialog.calls()).toEqual([
      { kind: 'files', options: { multiple: true, title: 'Attach' } },
      { kind: 'folder', options: { title: 'Choose' } },
      { kind: 'files', options: { multiple: false, title: 'Import' } },
      { kind: 'folder', options: { title: 'Choose', defaultPath: '/home' } },
    ])
  })
})

describe('createTestClipboardService', () => {
  it('records writes and fails on demand', async () => {
    const clipboard = createTestClipboardService()
    await clipboard.writeText('one')
    clipboard.failWith(new Error('denied'))
    await expect(clipboard.writeText('two')).rejects.toThrow('denied')
    clipboard.failWith(null)
    await clipboard.writeText('three')

    expect(clipboard.writes()).toEqual(['one', 'three'])
  })
})

describe('createTestOpenerService', () => {
  it('records urls and paths and logs failed fire-and-forget opens', async () => {
    const logger = createTestLoggerService()
    const opener = createTestOpenerService({ logger })
    await opener.openUrl('https://example.com')
    opener.openSystemSettings('contacts')
    await opener.revealInFileManager('/g')
    opener.failWith(new Error('no handler'))
    opener.openUrlSync('https://reflect.app')
    await expect(opener.revealInFileManager('/h')).rejects.toThrow('no handler')

    await vi.waitFor(() => expect(logger.getErrors()).toHaveLength(1))
    expect(opener.openedUrls()).toEqual([
      'https://example.com',
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
    ])
    expect(opener.revealedPaths()).toEqual(['/g'])
  })
})

describe('createTestPathService', () => {
  it('joins with POSIX syntax under a test home', async () => {
    const path = createTestPathService({ home: '/Users/alex' })
    await expect(path.join('/g', 'notes/a.md')).resolves.toBe('/g/notes/a.md')
    await expect(path.icloudDriveRoot()).resolves.toBe(
      '/Users/alex/Library/Mobile Documents/com~apple~CloudDocs',
    )
  })
})

describe('createTestWindowService', () => {
  it('records window actions', async () => {
    const window = createTestWindowService({
      label: 'note-1',
      openNoteWindow: (link) => link !== 'reflect://note/fail',
    })
    window.setTitle('Note A')
    await expect(window.openNoteWindow('reflect://note/a')).resolves.toBe(true)
    await expect(window.openNoteWindow('reflect://note/fail')).resolves.toBe(false)
    await window.closeSecondaryWindows()
    await window.emitTo('main', 'menu', 'note.find')
    await window.hide()
    await window.toggleDevtools()

    expect(window.isMainWindow()).toBe(false)
    expect(window.title()).toBe('Note A')
    expect(window.openedNoteWindows()).toEqual(['reflect://note/a', 'reflect://note/fail'])
    expect(window.closeSecondaryWindowsCalls()).toBe(1)
    expect(window.emitted()).toEqual([{ label: 'main', event: 'menu', payload: 'note.find' }])
    expect(window.hidden()).toBe(true)
    expect(window.devtoolsToggles()).toBe(1)
    await expect(window.focusedWindowLabel()).resolves.toBe('note-1')
    window.setFocusedWindowLabel(null)
    await expect(window.focusedWindowLabel()).resolves.toBeNull()
  })

  it('emits events to subscribers until they unsubscribe', async () => {
    const window = createTestWindowService()
    const navigate = vi.fn()
    const written = vi.fn()
    const menu = vi.fn()
    const unlisten = [
      window.subscribeNavigate(navigate),
      window.subscribeIndexWritten(written),
      window.subscribeWindowEvent('menu', menu),
    ]
    window.onCloseRequested((event) => {
      event.preventDefault()
    })

    window.emitNavigate('reflect://note/a')
    window.emitIndexWritten()
    window.emitWindowEvent('menu', 'note.find')
    window.emitWindowEvent('other', 'ignored')
    await expect(window.requestClose()).resolves.toEqual({ prevented: true })
    for (const dispose of unlisten) {
      dispose()
    }
    window.emitNavigate('reflect://note/b')
    window.emitIndexWritten()
    window.emitWindowEvent('menu', 'note.findNext')

    expect(navigate.mock.calls).toEqual([['reflect://note/a']])
    expect(written).toHaveBeenCalledOnce()
    expect(menu.mock.calls).toEqual([['note.find']])
  })

  it('bootstraps only when configured', async () => {
    await expect(createTestWindowService().bootstrap()).rejects.toThrow(/no bootstrap/)
    const boot = {
      graph: { root: '/g', name: 'g', generation: 1 },
      indexGeneration: null,
      initialDeepLink: null,
    }
    await expect(createTestWindowService({ bootstrap: boot }).bootstrap()).resolves.toEqual(boot)
  })
})

describe('createTestLifecycleService', () => {
  it('emits lifecycle signals to subscribers until they unsubscribe', () => {
    const lifecycle = createTestLifecycleService()
    const calls: string[] = []
    const unlisten = [
      lifecycle.subscribeResume(() => {
        calls.push('resume')
      }),
      lifecycle.subscribeWake(() => {
        calls.push('wake')
      }),
      lifecycle.subscribeVisible(() => {
        calls.push('visible')
      }),
      lifecycle.subscribeHidden(() => {
        calls.push('hidden')
      }),
      lifecycle.subscribePageHide(() => {
        calls.push('pagehide')
      }),
      lifecycle.subscribeBeforeUnload(() => {
        calls.push('beforeunload')
      }),
      lifecycle.subscribeQuitRequested(() => {
        calls.push('quit')
      }),
    ]

    lifecycle.emitResume()
    lifecycle.emitWake()
    lifecycle.emitHidden()
    expect(lifecycle.isHidden()).toBe(true)
    lifecycle.emitVisible()
    expect(lifecycle.isHidden()).toBe(false)
    lifecycle.emitPageHide()
    lifecycle.emitBeforeUnload()
    lifecycle.emitQuitRequested()
    for (const dispose of unlisten) {
      dispose()
    }
    lifecycle.emitResume()

    expect(calls).toEqual([
      'resume',
      'wake',
      'hidden',
      'visible',
      'pagehide',
      'beforeunload',
      'quit',
    ])
  })

  it('records quit confirmations and background tasks', async () => {
    const lifecycle = createTestLifecycleService({ hidden: true, backgroundTasks: true })
    expect(lifecycle.isHidden()).toBe(true)
    lifecycle.setHidden(false)
    expect(lifecycle.isHidden()).toBe(false)

    await lifecycle.confirmQuit()
    const token = await lifecycle.beginBackgroundTask()
    if (token === null) {
      throw new Error('expected a background task token')
    }
    await lifecycle.beginBackgroundTask()
    await lifecycle.endBackgroundTask(token)

    expect(lifecycle.confirmQuitCalls()).toBe(1)
    expect(lifecycle.backgroundTasks()).toEqual([
      { token: 'background-task-1', ended: true },
      { token: 'background-task-2', ended: false },
    ])
  })

  it('has no background task unless asked for one', async () => {
    await expect(createTestLifecycleService().beginBackgroundTask()).resolves.toBeNull()
  })
})
