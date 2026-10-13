import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecentGraph, WindowBootstrap } from '@reflect/core'
import {
  createTestAppServices,
  createTestGraphSessionService,
  createTestWindowService,
  type TestWindowService,
} from '@reflect/core/testing'
import { bootGraphSession } from './graph-session.ts'

// The session itself is covered in `@reflect/core`; these cover what the
// desktop app does at its boot.

const BOOT: WindowBootstrap = {
  graph: { root: '/g', name: 'g', generation: 3 },
  indexGeneration: 5,
  initialDeepLink: 'reflect://note/notes%2Ffoo.md',
}

let closeDatabase: () => void = () => {}

afterEach(() => {
  closeDatabase()
})

/** Boot a session of `windowService` over test doubles; `deepLinks` collects what the intake hands on. */
function boot(windowService: TestWindowService, recents: readonly RecentGraph[] = []) {
  const session = createTestGraphSessionService({ window: windowService, recents })
  const app = createTestAppServices({ window: windowService, graphSession: session })
  closeDatabase = () => app.database.close()
  const deepLinks: string[] = []
  app.deepLink.setHandler((url) => {
    deepLinks.push(url)
  })
  const stop = bootGraphSession(app)
  return { app, windowService, session, deepLinks, stop }
}

/** Boot a session in a note window whose bootstrap answers `bootstrap`, or fails without one. */
function bootNoteWindow(bootstrap?: WindowBootstrap) {
  return boot(
    createTestWindowService({
      label: 'note-1',
      ...(bootstrap === undefined ? {} : { bootstrap }),
    }),
  )
}

describe('bootGraphSession in a note window', () => {
  it('adopts the open sessions and seeds the router from a path-shaped link', async () => {
    const { session, windowService, app, deepLinks } = bootNoteWindow(BOOT)
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(session.getState().graph).toEqual(BOOT.graph)
    expect(session.getState().indexGeneration).toBe(5)
    // ⌘-click links resolve synchronously: the route slot is seeded and the
    // intake is bypassed, so the window never flashes today's daily note.
    expect(app.deepLink.getInitialWindowRoute()).toEqual({
      kind: 'note',
      path: 'notes/foo.md',
    })
    expect(deepLinks).toEqual([])
    // The adopted window honors focus-renavigate requests from a repeat
    // ⌘-click on its target. (Rename follow-through is desktop-root's, all
    // windows.)
    windowService.emitNavigate('reflect://note/notes%2Fbar.md')
    expect(deepLinks).toEqual(['reflect://note/notes%2Fbar.md'])
  })

  it('falls back to the intake for a target only the index can answer', async () => {
    const { session, app, deepLinks } = bootNoteWindow({
      ...BOOT,
      initialDeepLink: 'reflect://note/Meeting%20Notes',
    })
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(app.deepLink.getInitialWindowRoute()).toBeNull()
    expect(deepLinks).toEqual(['reflect://note/Meeting%20Notes'])
  })

  it('skips the deep-link dispatch when none is pending (a reload)', async () => {
    const { session, app, deepLinks } = bootNoteWindow({ ...BOOT, initialDeepLink: null })
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(app.deepLink.getInitialWindowRoute()).toBeNull()
    expect(deepLinks).toEqual([])
  })

  it('acts on the drained deep link even when the boot was stopped meanwhile', async () => {
    const { session, stop, app } = bootNoteWindow(BOOT)
    stop()
    await vi.waitFor(() => expect(app.deepLink.getInitialWindowRoute()).not.toBeNull())
    expect(session.getState().status).toBe('loading')
  })

  it('parks the window on a failed bootstrap', async () => {
    const { session } = bootNoteWindow()
    await vi.waitFor(() => expect(session.getState().status).toBe('choosing'))
    expect(session.getState().error).toContain('no bootstrap configured')
    expect(session.getState().graph).toBeNull()
  })

  it('stops following navigation requests when stopped', async () => {
    const { session, windowService, stop, deepLinks } = bootNoteWindow(BOOT)
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    stop()
    windowService.emitNavigate('reflect://note/notes%2Fbar.md')
    expect(deepLinks).toEqual([])
  })
})

describe('bootGraphSession in the main window', () => {
  it('reopens the most recent graph and seeds no window route', async () => {
    const { session, app } = boot(createTestWindowService(), [
      { root: '/known', name: 'known', openedMs: 1 },
    ])
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(session.getState().graph?.root).toBe('/known')
    expect(app.deepLink.getInitialWindowRoute()).toBeNull()
  })
})
