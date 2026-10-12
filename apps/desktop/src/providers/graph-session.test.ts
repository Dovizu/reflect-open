import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultDeepLink, setDefaultWindow, type WindowBootstrap } from '@reflect/core'
import {
  createTestDeepLinkService,
  createTestGraphSessionService,
  createTestWindowService,
} from '@reflect/core/testing'
import {
  getNoteRowOverlay,
  resetNoteRowOverlays,
  setNoteRowOverlay,
} from '@/hooks/note-row-overlay.ts'
import { queryClient, queryKeys } from '@/lib/query-client.ts'
import { getInitialWindowRoute } from '@/lib/windows/initial-window-route.ts'
import { bootGraphSession } from './graph-session.ts'

// The session itself is covered in `@reflect/core`; these cover what the
// desktop app does at its boot and with its events.

const BOOT: WindowBootstrap = {
  graph: { root: '/g', name: 'g', generation: 3 },
  indexGeneration: 5,
  initialDeepLink: 'reflect://note/notes%2Ffoo.md',
}

let deepLinks: string[]

beforeEach(() => {
  deepLinks = []
  const deepLink = createTestDeepLinkService()
  setDefaultDeepLink(deepLink)
  deepLink.setHandler((url) => {
    deepLinks.push(url)
  })
})

afterEach(() => {
  setDefaultDeepLink(null)
  setDefaultWindow(null)
  resetNoteRowOverlays()
  queryClient.clear()
  vi.restoreAllMocks()
})

/** Boot a session in a note window whose bootstrap answers `boot`, or fails without one. */
function bootNoteWindow(boot?: WindowBootstrap) {
  const windowService = createTestWindowService({
    label: 'note-1',
    ...(boot === undefined ? {} : { bootstrap: boot }),
  })
  setDefaultWindow(windowService)
  const session = createTestGraphSessionService({ window: windowService })
  const stop = bootGraphSession(session)
  return { windowService, session, stop }
}

describe('bootGraphSession in a note window', () => {
  it('adopts the open sessions and seeds the router from a path-shaped link', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { session, windowService } = bootNoteWindow(BOOT)
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(session.getState().graph).toEqual(BOOT.graph)
    expect(session.getState().indexGeneration).toBe(5)
    // ⌘-click links resolve synchronously: the route slot is seeded and the
    // intake is bypassed, so the window never flashes today's daily note.
    expect(getInitialWindowRoute()).toEqual({
      kind: 'note',
      path: 'notes/foo.md',
    })
    expect(deepLinks).toEqual([])
    // The adopted window refetches on committed index writes, never its own
    // indexer, and honors focus-renavigate requests from a repeat ⌘-click
    // on its target. (Rename follow-through is desktop-root's, all windows.)
    windowService.emitIndexWritten()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.index.all })
    windowService.emitNavigate('reflect://note/notes%2Fbar.md')
    expect(deepLinks).toEqual(['reflect://note/notes%2Fbar.md'])
  })

  it('falls back to the intake for a target only the index can answer', async () => {
    const { session } = bootNoteWindow({
      ...BOOT,
      initialDeepLink: 'reflect://note/Meeting%20Notes',
    })
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(getInitialWindowRoute()).toBeNull()
    expect(deepLinks).toEqual(['reflect://note/Meeting%20Notes'])
  })

  it('skips the deep-link dispatch when none is pending (a reload)', async () => {
    const { session } = bootNoteWindow({ ...BOOT, initialDeepLink: null })
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(getInitialWindowRoute()).toBeNull()
    expect(deepLinks).toEqual([])
  })

  it('acts on the drained deep link even when the boot was stopped meanwhile', async () => {
    const { session, stop } = bootNoteWindow(BOOT)
    stop()
    await vi.waitFor(() => expect(getInitialWindowRoute()).not.toBeNull())
    expect(session.getState().status).toBe('loading')
  })

  it('parks the window on a failed bootstrap', async () => {
    const { session, windowService } = bootNoteWindow()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    await vi.waitFor(() => expect(session.getState().status).toBe('choosing'))
    expect(session.getState().error).toContain('no bootstrap configured')
    expect(session.getState().graph).toBeNull()
    windowService.emitIndexWritten()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('unsubscribes both listeners when stopped', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { session, windowService, stop } = bootNoteWindow(BOOT)
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    stop()
    windowService.emitIndexWritten()
    windowService.emitNavigate('reflect://note/notes%2Fbar.md')
    expect(invalidate).not.toHaveBeenCalled()
    expect(deepLinks).toEqual([])
  })
})

describe('bootGraphSession in the main window', () => {
  function bootMainWindow() {
    const windowService = createTestWindowService()
    setDefaultWindow(windowService)
    const session = createTestGraphSessionService({
      window: windowService,
      recents: [{ root: '/known', name: 'known', openedMs: 1 }],
    })
    const stop = bootGraphSession(session)
    return { windowService, session, stop }
  }

  it('reopens the most recent graph and follows no note-window events', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { session, windowService } = bootMainWindow()
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    expect(session.getState().graph?.root).toBe('/known')
    windowService.emitIndexWritten()
    expect(invalidate).not.toHaveBeenCalled()
    expect(getInitialWindowRoute()).toBeNull()
  })

  it('drops the previous graph’s row overlays and similar notes on a switch', async () => {
    const { session } = bootMainWindow()
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    setNoteRowOverlay('notes/a.md', 1, { gistStale: true })
    queryClient.setQueryData([...queryKeys.similar.all, '/known', 'notes/a.md'], [])
    queryClient.setQueryData(queryKeys.icloud.status, { available: true })

    await session.openRecent('/other')

    expect(getNoteRowOverlay('notes/a.md', 1)).toBeNull()
    expect(queryClient.getQueriesData({ queryKey: queryKeys.similar.all })).toEqual([])
    expect(queryClient.getQueryData(queryKeys.icloud.status)).toEqual({ available: true })
  })

  it('keeps similar notes but drops row overlays when the graph closes', async () => {
    const { session } = bootMainWindow()
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    setNoteRowOverlay('notes/a.md', 1, { gistStale: true })
    queryClient.setQueryData([...queryKeys.similar.all, '/known', 'notes/a.md'], [])

    await session.chooseGraph()

    expect(getNoteRowOverlay('notes/a.md', 1)).toBeNull()
    expect(queryClient.getQueriesData({ queryKey: queryKeys.similar.all })).toHaveLength(1)
  })

  it('drops the cached iCloud listing when the graph is deleted', async () => {
    const { session } = bootMainWindow()
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    // The chooser's listing was cached before the delete; without the drop it
    // would keep showing the deleted graph (queries never go stale on their own).
    queryClient.setQueryData(queryKeys.icloud.status, {
      available: true,
      documentsRoot: '/icloud/Documents',
      existingGraphRoots: ['/known'],
    })

    await session.deleteGraph()

    expect(session.getState().status).toBe('choosing')
    expect(queryClient.getQueryData(queryKeys.icloud.status)).toBeUndefined()
  })

  it('stops reacting once stopped', async () => {
    const { session, stop } = bootMainWindow()
    await vi.waitFor(() => expect(session.getState().status).toBe('ready'))
    stop()
    setNoteRowOverlay('notes/a.md', 1, { gistStale: true })

    await session.chooseGraph()

    expect(getNoteRowOverlay('notes/a.md', 1)).not.toBeNull()
  })
})
