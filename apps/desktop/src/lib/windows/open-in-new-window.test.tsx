import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultWindow } from '@reflect/core'
import { createTestWindowService, type TestWindowService } from '@reflect/core/testing'

const isNativeShell = vi.hoisted(() => vi.fn(() => true))
const isMobileSurface = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/lib/platform.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/platform.ts')>()),
  isNativeShell,
}))
vi.mock('@/lib/platform-surface.ts', () => ({ isMobileSurface }))

import { openDeepLinkInNewWindow, openRouteInNewWindow } from './open-in-new-window.ts'

let windows: TestWindowService
let opens: boolean

beforeEach(() => {
  vi.clearAllMocks()
  isNativeShell.mockReturnValue(true)
  isMobileSurface.mockReturnValue(false)
  opens = true
  windows = createTestWindowService({ openNoteWindow: () => opens })
  setDefaultWindow(windows)
})

describe('openRouteInNewWindow', () => {
  it('opens the route’s deep link', async () => {
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(true)
    expect(windows.openedNoteWindows()).toEqual(['reflect://note/notes%2Ffoo.md'])
  })

  it('declines routes the deep-link grammar does not name', async () => {
    await expect(openRouteInNewWindow({ kind: 'allNotes', tag: null })).resolves.toBe(false)
    expect(windows.openedNoteWindows()).toEqual([])
  })

  it('declines without a native shell and on mobile', async () => {
    isNativeShell.mockReturnValue(false)
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(false)
    isNativeShell.mockReturnValue(true)
    isMobileSurface.mockReturnValue(true)
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(false)
    expect(windows.openedNoteWindows()).toEqual([])
  })

  it('answers false when the window does not open', async () => {
    opens = false
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(false)
  })
})

describe('openDeepLinkInNewWindow', () => {
  it('opens addressing links verbatim', async () => {
    await expect(openDeepLinkInNewWindow('reflect://note/Some%20Note')).resolves.toBe(true)
    expect(windows.openedNoteWindows()).toEqual(['reflect://note/Some%20Note'])
  })

  it('declines capture links — they are writes, not places', async () => {
    await expect(openDeepLinkInNewWindow('reflect://append?text=hi')).resolves.toBe(false)
    expect(windows.openedNoteWindows()).toEqual([])
  })

  it('declines malformed links', async () => {
    await expect(openDeepLinkInNewWindow('reflect://nonsense/x')).resolves.toBe(false)
    expect(windows.openedNoteWindows()).toEqual([])
  })
})
