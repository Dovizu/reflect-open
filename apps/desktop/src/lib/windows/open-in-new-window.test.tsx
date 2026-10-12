import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultPlatform } from '@reflect/core'
import { createTestPlatformService } from '@reflect/core/testing'

const openNoteWindow = vi.hoisted(() => vi.fn<(link: string) => Promise<void>>())

vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  openNoteWindow,
}))

import { openDeepLinkInNewWindow, openRouteInNewWindow } from './open-in-new-window.ts'

beforeEach(() => {
  vi.clearAllMocks()
  setDefaultPlatform(createTestPlatformService())
  openNoteWindow.mockResolvedValue(undefined)
})

afterEach(() => {
  setDefaultPlatform(null)
})

describe('openRouteInNewWindow', () => {
  it('opens the route’s deep link', async () => {
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(true)
    expect(openNoteWindow).toHaveBeenCalledWith('reflect://note/notes%2Ffoo.md')
  })

  it('shares one native request between concurrent opens of the same note', async () => {
    const pendingOpen = Promise.withResolvers<void>()
    openNoteWindow.mockReturnValue(pendingOpen.promise)

    const first = openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })
    const second = openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })

    expect(openNoteWindow).toHaveBeenCalledTimes(1)
    pendingOpen.resolve()
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])

    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(true)
    expect(openNoteWindow).toHaveBeenCalledTimes(2)
  })

  it('declines routes the deep-link grammar does not name', async () => {
    await expect(openRouteInNewWindow({ kind: 'allNotes', tag: null })).resolves.toBe(false)
    expect(openNoteWindow).not.toHaveBeenCalled()
  })

  it('declines without a native shell and on mobile', async () => {
    setDefaultPlatform(createTestPlatformService({ isNativeShell: false }))
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(false)
    setDefaultPlatform(createTestPlatformService({ surface: { mobileApp: true } }))
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(false)
    expect(openNoteWindow).not.toHaveBeenCalled()
  })

  it('degrades a failed command to false instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    openNoteWindow.mockRejectedValue(new Error('no window for you'))
    await expect(openRouteInNewWindow({ kind: 'note', path: 'notes/foo.md' })).resolves.toBe(false)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('openDeepLinkInNewWindow', () => {
  it('opens addressing links verbatim', async () => {
    await expect(openDeepLinkInNewWindow('reflect://note/Some%20Note')).resolves.toBe(true)
    expect(openNoteWindow).toHaveBeenCalledWith('reflect://note/Some%20Note')
  })

  it('declines capture links — they are writes, not places', async () => {
    await expect(openDeepLinkInNewWindow('reflect://append?text=hi')).resolves.toBe(false)
    expect(openNoteWindow).not.toHaveBeenCalled()
  })

  it('declines malformed links', async () => {
    await expect(openDeepLinkInNewWindow('reflect://nonsense/x')).resolves.toBe(false)
    expect(openNoteWindow).not.toHaveBeenCalled()
  })
})
