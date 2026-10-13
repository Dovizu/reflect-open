import { describe, expect, it, vi } from 'vitest'
import { createGraphSession, type GraphRole, type GraphSession } from '../app/graph-session.ts'
import { createNoteRowService } from '../documents/note-row-service.ts'
import { createTestGraphSessionService } from '../testing/graph-session.ts'
import { createTestNoteFileService } from '../testing/graph.ts'
import { createTestIndexLifecycleService } from '../testing/index-lifecycle.ts'
import { createTestIndexStoreService } from '../testing/index-store.ts'
import { createTestFileChangeService } from '../testing/file-change.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestMobileStorageService } from '../testing/mobile-storage.ts'
import { createTestPlatformService, type TestPlatformOptions } from '../testing/platform.ts'
import { createTestICloudNativeService } from '../testing/sync.ts'
import {
  createTestDialogService,
  createTestLifecycleService,
  createTestPathService,
  createTestWindowService,
} from '../testing/shell.ts'
import type { GraphReleaseReason, GraphSessionState } from './graph-session-service.ts'
import { WELCOME_NOTE_PATH, WELCOME_SEEDED_META_KEY } from './onboarding.ts'
import type { RecentGraph, WindowBootstrap } from './schemas.ts'

const BOOT: WindowBootstrap = {
  graph: { root: '/g', name: 'g', generation: 3 },
  indexGeneration: 5,
  initialDeepLink: 'reflect://note/notes%2Ffoo.md',
}

interface SetupOptions {
  recents?: RecentGraph[]
  /** Files of every graph the bridge opens. */
  files?: Record<string, string>
  meta?: Record<string, string>
  platform?: TestPlatformOptions
  windowLabel?: string
  bootstrap?: WindowBootstrap
  hidden?: boolean
  /** Hold every `graph_open` until `resolveOpen(root)`. */
  holdOpens?: boolean
  indexOpenFails?: boolean
}

/** A session over fakes whose bridge keeps recents and counts graph generations. */
function setup(options?: SetupOptions) {
  let recents = [...(options?.recents ?? [])]
  let generation = 0
  const pendingOpens = new Map<string, () => void>()
  const failures = { open: false, recents: false, delete: false, forget: false }
  const logger = createTestLoggerService()
  const ipc = createTestIpcBridgeService({
    logger,
    commands: {
      recent_graphs: () => {
        if (failures.recents) {
          throw { kind: 'io', message: 'recents are corrupt' }
        }
        return recents
      },
      forget_recent: (args) => {
        if (failures.forget) {
          throw { kind: 'io', message: 'cannot forget' }
        }
        recents = recents.filter((recent) => recent.root !== args['root'])
        return null
      },
      graph_open: async (args) => {
        if (failures.open) {
          throw { kind: 'io', message: 'cannot open graph' }
        }
        const root = String(args['path'])
        if (options?.holdOpens ?? false) {
          await new Promise<void>((resolve) => {
            pendingOpens.set(root, resolve)
          })
        }
        generation += 1
        return { root, name: root.split('/').findLast(Boolean) ?? '', generation }
      },
      graph_delete: () => {
        if (failures.delete) {
          throw { kind: 'io', message: 'cannot trash' }
        }
        return null
      },
    },
  })
  const noteFile = createTestNoteFileService({ files: options?.files ?? {} })
  const indexStore = createTestIndexStoreService({
    meta: options?.meta ?? {},
    ...(options?.indexOpenFails
      ? { fail: (call) => (call.method === 'open' ? new Error('index is broken') : undefined) }
      : {}),
  })
  const fileChanges = createTestFileChangeService()
  const indexLifecycle = createTestIndexLifecycleService({
    indexStore,
    noteFile,
    fileChanges,
    logger,
  })
  const windowService = createTestWindowService({
    ...(options?.windowLabel === undefined ? {} : { label: options.windowLabel }),
    ...(options?.bootstrap === undefined ? {} : { bootstrap: options.bootstrap }),
  })
  const dialog = createTestDialogService()
  const lifecycle = createTestLifecycleService({ hidden: options?.hidden ?? false })
  const mobileStorage = createTestMobileStorageService()
  const noteRows = createNoteRowService()
  const icloudNative = createTestICloudNativeService()
  const reloads: number[] = []
  const healedMoves: [string, string][] = []
  const built: { session: GraphSession; role: GraphRole; services: { id: number } }[] = []
  const session = createTestGraphSessionService({
    ipc,
    indexLifecycle,
    indexStore,
    noteFile,
    fileChanges,
    window: windowService,
    dialog,
    path: createTestPathService({ home: '/Users/me' }),
    platform: createTestPlatformService(options?.platform),
    lifecycle,
    mobileStorage,
    noteRows,
    openDocuments: {
      reloadAll: () => {
        reloads.push(reloads.length + 1)
      },
    },
    noteMove: {
      followHealedMove: (from, to) => {
        healedMoves.push([from, to])
      },
    },
    icloudNative,
    logger,
    createServices: (opened, role) => {
      const services = { id: built.length + 1 }
      built.push({ session: opened, role, services })
      return services
    },
  })
  const states: GraphSessionState<{ id: number }>[] = []
  session.subscribe(() => {
    states.push(session.getState())
  })
  const released: GraphReleaseReason[] = []
  session.onGraphReleased((reason) => {
    released.push(reason)
  })
  const deleted: string[] = []
  session.onGraphDeleted((root) => {
    deleted.push(root)
  })

  return {
    session,
    ipc,
    logger,
    noteFile,
    indexStore,
    indexLifecycle,
    fileChanges,
    windowService,
    dialog,
    lifecycle,
    mobileStorage,
    noteRows,
    icloudNative,
    reloads,
    healedMoves,
    built,
    failures,
    states,
    released,
    deleted,
    commands: () => ipc.calls().map((call) => call.command),
    hasPendingOpen: (root: string) => pendingOpens.has(root),
    resolveOpen: (root: string) => {
      pendingOpens.get(root)?.()
      pendingOpens.delete(root)
    },
    /** Calls of the index store by method name, in order. */
    indexCalls: () => indexStore.calls().map((call) => call.method),
  }
}

/** Boot a desktop main window and wait until its boot path settled. */
async function bootDesktop(options?: SetupOptions) {
  const context = setup(options)
  const stop = context.session.boot()
  await expect.poll(() => context.session.getState().status).not.toBe('loading')
  await expect.poll(() => context.session.getState().status).not.toBe('opening')
  return { ...context, stop }
}

/** Wait until every pass the index lifecycle started has settled. */
async function settleIndex(context: { indexLifecycle: { settled: () => Promise<void> } }) {
  await Promise.resolve()
  await context.indexLifecycle.settled()
}

describe('GraphSessionService desktop boot', () => {
  it('starts at the chooser when there are no recents', async () => {
    const { session } = await bootDesktop()
    expect(session.getState()).toMatchObject({
      status: 'choosing',
      graph: null,
      session: null,
      error: null,
    })
  })

  it('reopens the most recent graph', async () => {
    const recents = [
      { root: '/known', name: 'known', openedMs: 2 },
      { root: '/older', name: 'older', openedMs: 1 },
    ]
    const { session } = await bootDesktop({ recents })
    expect(session.getState()).toMatchObject({
      status: 'ready',
      graph: { root: '/known', name: 'known', generation: 1 },
      indexGeneration: 1,
      recents,
    })
  })

  it('surfaces a failed recents read', async () => {
    const context = setup()
    context.failures.recents = true
    context.session.boot()
    await expect.poll(() => context.session.getState().status).toBe('choosing')
    expect(context.session.getState().error).toMatch(/recents are corrupt/)
  })

  it('opens nothing when the boot was stopped before the recents arrived', async () => {
    const context = setup({ recents: [{ root: '/known', name: 'known', openedMs: 1 }] })
    const stop = context.session.boot()
    stop()
    await expect.poll(() => context.session.getState().recents).toHaveLength(1)
    await Promise.resolve()
    expect(context.session.getState().status).toBe('loading')
    expect(context.commands()).not.toContain('graph_open')
  })

  it('waits for the host on mobile', async () => {
    const context = setup({
      platform: { appPlatform: 'ios' },
      recents: [{ root: '/known', name: 'known', openedMs: 1 }],
    })
    context.session.boot()
    await Promise.resolve()
    expect(context.session.getState().status).toBe('loading')
    expect(context.commands()).toEqual([])

    context.session.park('iCloud isn’t available')
    expect(context.session.getState()).toMatchObject({
      status: 'choosing',
      error: 'iCloud isn’t available',
    })
  })
})

describe('GraphSessionService note-window boot', () => {
  it('adopts the main window’s sessions without opening anything', async () => {
    const context = setup({ windowLabel: 'note-1', bootstrap: BOOT })
    const boots: WindowBootstrap[] = []
    context.session.boot({
      onWindowBootstrap: (boot) => {
        boots.push(boot)
      },
    })
    await expect.poll(() => context.session.getState().status).toBe('ready')

    const state = context.session.getState()
    expect(state.graph).toEqual(BOOT.graph)
    expect(state.indexGeneration).toBe(5)
    expect(state.session).toMatchObject({
      root: '/g',
      name: 'g',
      generation: 3,
      indexGeneration: 5,
    })
    expect(boots).toEqual([BOOT])
    expect(context.commands()).toEqual([])
    expect(context.indexCalls()).toEqual([])
  })

  it('reports the bootstrap but adopts nothing once stopped', async () => {
    const context = setup({ windowLabel: 'note-1', bootstrap: BOOT })
    const boots: WindowBootstrap[] = []
    const stop = context.session.boot({
      onWindowBootstrap: (boot) => {
        boots.push(boot)
      },
    })
    stop()
    await expect.poll(() => boots).toEqual([BOOT])
    expect(context.session.getState().status).toBe('loading')
  })

  it('parks the window on a failed bootstrap', async () => {
    const context = setup({ windowLabel: 'note-1' })
    context.session.boot()
    await expect.poll(() => context.session.getState().status).toBe('choosing')
    expect(context.session.getState().error).toContain('no bootstrap configured')
    expect(context.session.getState().graph).toBeNull()
  })

  it('refuses graph mutations', async () => {
    const context = setup({ windowLabel: 'note-1', bootstrap: BOOT })
    context.session.boot()
    await expect.poll(() => context.session.getState().status).toBe('ready')

    await expect(context.session.openRecent('/other')).resolves.toBe(false)
    await expect(context.session.createGraphAt('/new')).resolves.toBe(false)
    await context.session.chooseGraph()
    await expect(context.session.deleteGraph()).rejects.toThrow(
      /only available from the main window/,
    )
    context.session.refreshIndex()

    expect(context.session.getState().graph).toEqual(BOOT.graph)
    expect(context.commands()).toEqual([])
    expect(context.mobileStorage.createdGraphs()).toEqual([])
    expect(context.indexCalls()).toEqual([])
    expect(context.logger.getWarnings().map((entry) => entry.message)).toEqual([
      'opening a graph is only available from the main window',
      'creating a graph is only available from the main window',
      'switching graphs is only available from the main window',
    ])
  })
})

/**
 * The open-ordering guards: overlapping opens are serialized against the
 * backend and only the most recently requested one may commit state.
 */
describe('GraphSessionService open sequencing', () => {
  it('serializes overlapping opens and commits only the last requested graph', async () => {
    const context = await bootDesktop({ holdOpens: true })
    const { session } = context

    const firstOpen = session.openRecent('/a')
    const secondOpen = session.openRecent('/b')
    expect(session.getState().status).toBe('opening')

    // The second backend open must wait for the first (Rust GraphState is
    // last-write-wins; running in request order keeps it on the last graph).
    await expect.poll(() => context.hasPendingOpen('/a')).toBe(true)
    expect(context.hasPendingOpen('/b')).toBe(false)

    context.resolveOpen('/a')
    await expect.poll(() => context.hasPendingOpen('/b')).toBe(true)
    context.resolveOpen('/b')
    await expect(firstOpen).resolves.toBe(false)
    await expect(secondOpen).resolves.toBe(true)

    expect(session.getState().status).toBe('ready')
    // The superseded first open must not have committed its graph.
    expect(session.getState().graph?.root).toBe('/b')
    expect(context.states.map((state) => state.graph?.root)).not.toContain('/a')
  })

  it('closes note windows BEFORE the backend open bumps the session', async () => {
    // Note windows adopted the outgoing session; their close-requested
    // flushes must land against its still-valid generation, so the close
    // precedes graph_open (bump-first would reject the saves).
    const context = await bootDesktop({ holdOpens: true })
    const opened = context.session.openRecent('/a')
    await expect.poll(() => context.hasPendingOpen('/a')).toBe(true)
    expect(context.windowService.closeSecondaryWindowsCalls()).toBe(1)
    context.resolveOpen('/a')
    await opened
  })

  it('leaves note windows alone on mobile', async () => {
    const context = setup({ platform: { appPlatform: 'ios' } })
    await expect(context.session.openRecent('/a')).resolves.toBe(true)
    await context.session.chooseGraph()
    expect(context.windowService.closeSecondaryWindowsCalls()).toBe(0)
  })

  it('surfaces an open failure and returns to the chooser', async () => {
    const context = await bootDesktop()
    context.failures.open = true

    await expect(context.session.openRecent('/broken')).resolves.toBe(false)

    expect(context.session.getState().status).toBe('choosing')
    expect(context.session.getState().error).toMatch(/cannot open graph/)
  })

  it('clears the previous error when an open starts', async () => {
    const context = await bootDesktop()
    context.failures.open = true
    await context.session.openRecent('/broken')
    context.failures.open = false

    await expect(context.session.openRecent('/a')).resolves.toBe(true)
    expect(context.session.getState()).toMatchObject({ status: 'ready', error: null })
  })

  it('opens the graph without an index session when the index fails to open', async () => {
    const context = await bootDesktop({ indexOpenFails: true })

    await expect(context.session.openRecent('/a')).resolves.toBe(true)

    expect(context.session.getState()).toMatchObject({
      status: 'ready',
      graph: { root: '/a' },
      indexGeneration: null,
      session: null,
    })
    expect(context.noteFile.writes()).toEqual([])
    expect(context.indexCalls()).not.toContain('reconcileScan')
    expect(context.logger.getErrors().map((entry) => entry.message)).toEqual(['index open failed:'])
  })

  it('reloads the recents after an open', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    expect(context.commands().filter((command) => command === 'recent_graphs')).toHaveLength(2)
  })

  it('tells listeners when the previous graph is released', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    expect(context.released).toEqual(['switch'])
    await context.session.chooseGraph()
    expect(context.released).toEqual(['switch', 'close'])
  })
})

describe('GraphSessionService session object', () => {
  it('publishes one session per open and aborts it when another open is requested', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    const first = context.session.getState().session
    expect(first).toMatchObject({ root: '/a', name: 'a', generation: 1, indexGeneration: 1 })
    expect(first?.signal.aborted).toBe(false)

    const opening = context.session.openRecent('/b')
    expect(first?.signal.aborted).toBe(true)
    await opening

    const second = context.session.getState().session
    expect(second).toMatchObject({ root: '/b', generation: 2 })
    expect(second?.signal.aborted).toBe(false)
  })

  it('aborts the session when the graph closes', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    const { session: opened } = context.session.getState()

    await context.session.chooseGraph()

    expect(opened?.signal.aborted).toBe(true)
    expect(context.session.getState().session).toBeNull()
  })
})

describe('GraphSessionService close flows', () => {
  const recents = [{ root: '/known', name: 'known', openedMs: 1 }]

  it('forgets the open graph and returns to the chooser', async () => {
    const context = await bootDesktop({ recents })
    expect(context.session.getState().status).toBe('ready')

    await context.session.forgetRecent('/known')

    expect(context.session.getState()).toMatchObject({
      status: 'choosing',
      graph: null,
      indexGeneration: null,
      recents: [],
    })
    // Boot open, then the forget: the active graph's note windows close first.
    expect(context.windowService.closeSecondaryWindowsCalls()).toBe(2)
  })

  it('forgets another graph without closing the open one', async () => {
    const context = await bootDesktop({
      recents: [...recents, { root: '/older', name: 'older', openedMs: 0 }],
    })

    await context.session.forgetRecent('/older')

    expect(context.session.getState()).toMatchObject({
      status: 'ready',
      graph: { root: '/known' },
      recents,
    })
  })

  it('ignores a failed forget', async () => {
    const context = await bootDesktop({ recents })
    context.failures.forget = true

    await context.session.forgetRecent('/known')

    expect(context.session.getState()).toMatchObject({ status: 'ready', error: null, recents })
  })

  it('returns to the graph chooser without opening the folder picker', async () => {
    const context = await bootDesktop({ recents })

    await context.session.chooseGraph()

    expect(context.session.getState()).toMatchObject({
      status: 'choosing',
      graph: null,
      indexGeneration: null,
      indexing: false,
      recents,
    })
    expect(context.dialog.calls()).toEqual([])
    expect(context.fileChanges.watcherRunning()).toBe(false)
  })

  it('deletes the open graph and tells listeners', async () => {
    const context = await bootDesktop({ recents })

    await context.session.deleteGraph()

    expect(context.ipc.calls()).toContainEqual({ command: 'graph_delete', args: { generation: 1 } })
    expect(context.deleted).toEqual(['/known'])
    expect(context.session.getState()).toMatchObject({ status: 'choosing', graph: null })
    expect(context.windowService.closeSecondaryWindowsCalls()).toBe(2)
  })

  it('reopens the graph and rethrows when the delete fails', async () => {
    const context = await bootDesktop({ recents })
    context.failures.delete = true

    await expect(context.session.deleteGraph()).rejects.toMatchObject({ message: 'cannot trash' })

    // The command invalidated the session pin: a fresh open restores a writable one.
    expect(context.session.getState()).toMatchObject({
      status: 'ready',
      graph: { root: '/known', generation: 2 },
    })
    expect(context.deleted).toEqual([])
  })

  it('does nothing when no graph is open', async () => {
    const context = await bootDesktop()
    await context.session.deleteGraph()
    expect(context.commands()).not.toContain('graph_delete')
  })
})

describe('GraphSessionService create and pick', () => {
  it('creates the graph, then opens it', async () => {
    const context = await bootDesktop()

    await expect(context.session.createGraphAt('/icloud/Documents/Work')).resolves.toBe(true)

    expect(context.mobileStorage.createdGraphs()).toEqual(['/icloud/Documents/Work'])
    expect(context.session.getState().graph?.root).toBe('/icloud/Documents/Work')
  })

  it('surfaces a failed create without opening', async () => {
    const context = await bootDesktop()
    context.mobileStorage.createGraph = async () => {
      throw new Error('cannot create')
    }

    await expect(context.session.createGraphAt('/new')).resolves.toBe(false)

    expect(context.session.getState()).toMatchObject({ status: 'choosing', error: 'cannot create' })
    expect(context.commands()).not.toContain('graph_open')
  })

  it('opens the picked folder, suggesting iCloud Drive on a macOS first run', async () => {
    const context = await bootDesktop()
    context.dialog.setFolder('/fresh')

    await context.session.pickAndOpen()

    expect(context.dialog.calls()).toEqual([
      {
        kind: 'folder',
        options: {
          title: 'Choose a graph folder',
          defaultPath: '/Users/me/Library/Mobile Documents/com~apple~CloudDocs',
        },
      },
    ])
    expect(context.session.getState()).toMatchObject({ status: 'ready', graph: { root: '/fresh' } })
  })

  it('suggests no folder once a graph is known', async () => {
    const context = await bootDesktop({ recents: [{ root: '/known', name: 'known', openedMs: 1 }] })
    await context.session.pickAndOpen()
    expect(context.dialog.calls()).toEqual([
      { kind: 'folder', options: { title: 'Choose a graph folder' } },
    ])
    // A cancelled picker changes nothing.
    expect(context.session.getState().graph?.root).toBe('/known')
  })

  it('suggests no folder off macOS', async () => {
    const context = await bootDesktop({ platform: { isMacosDesktop: false } })
    await context.session.pickAndOpen()
    expect(context.dialog.calls()).toEqual([
      { kind: 'folder', options: { title: 'Choose a graph folder' } },
    ])
  })

  it('surfaces a picker failure', async () => {
    const context = await bootDesktop()
    context.dialog.pickFolder = async () => {
      throw new Error('picker crashed')
    }
    await context.session.pickAndOpen()
    expect(context.session.getState().error).toBe('picker crashed')
  })
})

describe('GraphSessionService welcome seeding', () => {
  it('seeds an empty unmarked graph and stamps the welcomeSeeded marker', async () => {
    const context = await bootDesktop()

    await context.session.openRecent('/fresh')
    await expect.poll(() => context.indexStore.getMeta(WELCOME_SEEDED_META_KEY)).toBe('true')

    expect(context.noteFile.writes().map((write) => write.path)).toEqual([WELCOME_NOTE_PATH])
    // The reconcile starts only after the seed attempt, so it indexes the note.
    await settleIndex(context)
    const calls = context.indexCalls()
    expect(calls.indexOf('setMeta')).toBeLessThan(calls.lastIndexOf('applyBatch'))
    expect(context.indexStore.applied().map((note) => note.path)).toContain(WELCOME_NOTE_PATH)
  })

  it('never seeds a marked graph, even when it is empty (deleted notes stay deleted)', async () => {
    const context = await bootDesktop({ meta: { [WELCOME_SEEDED_META_KEY]: 'true' } })
    await context.session.openRecent('/known')
    await settleIndex(context)
    expect(context.noteFile.writes()).toEqual([])
  })

  it('marks an unmarked graph with existing notes without writing into it', async () => {
    const context = await bootDesktop({ files: { 'daily/2026-06-12.md': 'hello' } })
    await context.session.openRecent('/existing')
    await expect
      .poll(() => context.indexStore.getMeta(WELCOME_SEEDED_META_KEY))
      // Onboarding was considered: emptying this graph later won't re-seed.
      .toBe('true')
    expect(context.noteFile.writes()).toEqual([])
  })

  it('logs a failed seed and still syncs the index', async () => {
    const context = await bootDesktop()
    context.noteFile.vaultScanStats = async () => {
      throw new Error('scan failed')
    }

    await context.session.openRecent('/fresh')
    await expect.poll(() => context.indexCalls()).toContain('clear')

    expect(context.session.getState().status).toBe('ready')
    expect(context.logger.getErrors()).toContainEqual({
      message: 'welcome seed failed:',
      cause: 'scan failed',
    })
  })
})

describe('GraphSessionService index following', () => {
  it('reports indexing while the open graph reconciles', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    await expect.poll(() => context.states.some((state) => state.indexing)).toBe(true)
    await settleIndex(context)
    expect(context.session.getState().indexing).toBe(false)
  })

  it('re-runs the reconcile on request and on a watcher demand', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    await settleIndex(context)
    const passes = (): number =>
      context.indexCalls().filter((method) => method === 'reconcileScan' || method === 'clear')
        .length
    const before = passes()

    context.session.refreshIndex()
    await expect.poll(passes).toBe(before + 1)
    await settleIndex(context)

    // A structural vault change cannot be expressed as per-file events.
    context.fileChanges.emitReconcile()
    await expect.poll(passes).toBe(before + 2)
  })

  it('refreshes nothing while no index is open', async () => {
    const context = await bootDesktop()
    context.session.refreshIndex()
    context.fileChanges.emitReconcile()
    await settleIndex(context)
    expect(context.indexCalls()).toEqual([])
  })

  it('stops following once the boot is stopped', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    await settleIndex(context)
    context.stop()
    expect(context.fileChanges.listenerCount().reconcile).toBe(0)

    const count = context.states.length
    context.indexLifecycle.sync(
      createGraphSession({ root: '/a', name: 'a', generation: 1, indexGeneration: 1 }),
    )
    await settleIndex(context)
    expect(context.states).toHaveLength(count)
  })
})

describe('GraphSessionService mobile suspension', () => {
  const ios = { appPlatform: 'ios' } as const

  function passes(context: { indexCalls: () => string[] }): number {
    return context.indexCalls().filter((method) => method === 'clear').length
  }

  it('defers the first index pass while hidden and replays it on foreground', async () => {
    const context = setup({ platform: ios, hidden: true })
    context.session.boot()

    await expect(context.session.openRecent('/Documents')).resolves.toBe(true)
    await expect.poll(() => context.indexStore.getMeta(WELCOME_SEEDED_META_KEY)).toBe('true')
    await settleIndex(context)
    expect(passes(context)).toBe(0)

    // Resume performs a full sync, which catches files and local events the
    // intentionally absent live subscription could not observe while hidden.
    context.lifecycle.emitVisible()
    await expect.poll(() => passes(context)).toBe(1)
  })

  it('clears suspension when the app foregrounds before its index session opens', async () => {
    const context = setup({ platform: ios, hidden: true })
    context.session.boot()
    expect(context.session.getState().indexGeneration).toBeNull()

    // The app foregrounds while onboarding still has no graph/index. This
    // must clear the sticky suspension even though there is nothing to sync.
    context.lifecycle.emitVisible()
    await settleIndex(context)
    expect(passes(context)).toBe(0)

    await context.session.openRecent('/Documents')
    await expect.poll(() => passes(context)).toBe(1)
    expect(context.session.getState().status).toBe('ready')
  })

  it('suspends the live index when the app hides', async () => {
    const context = setup({ platform: ios })
    context.session.boot()
    await context.session.openRecent('/Documents')
    await expect.poll(() => context.fileChanges.listenerCount().changes).toBe(1)

    context.lifecycle.emitHidden()

    expect(context.fileChanges.listenerCount().changes).toBe(0)
    context.session.refreshIndex()
    await settleIndex(context)
    expect(passes(context)).toBe(1)
  })

  it('never suspends on desktop', async () => {
    const context = await bootDesktop({ hidden: true })
    await context.session.openRecent('/a')
    await expect.poll(() => passes(context)).toBe(1)
    context.lifecycle.emitHidden()
    await settleIndex(context)
    expect(context.fileChanges.listenerCount().changes).toBe(1)
  })

  it('removes the suspend guard once the boot is stopped', async () => {
    const context = setup({ platform: ios })
    const stop = context.session.boot()
    stop()
    context.lifecycle.setHidden(true)

    context.indexLifecycle.sync(
      createGraphSession({ root: '/a', name: 'a', generation: 1, indexGeneration: 1 }),
    )
    await settleIndex(context)
    expect(passes(context)).toBe(1)
  })
})

describe('GraphSessionService graph services', () => {
  it('builds the services of each opened session and ends them with it', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    const first = context.session.getState()
    expect(context.built.map(({ role }) => role)).toEqual(['main'])
    expect(context.built[0]?.session).toBe(first.session)
    expect(first.services).toBe(context.built[0]?.services)

    const opening = context.session.openRecent('/b')
    expect(first.session?.signal.aborted).toBe(true)
    expect(context.session.getState().services).toBeNull()
    await opening
    expect(context.session.getState().services).toEqual({ id: 2 })

    await context.session.chooseGraph()
    expect(context.built[1]?.session.signal.aborted).toBe(true)
    expect(context.session.getState().services).toBeNull()
  })

  it('builds note-window services for an adopted session', async () => {
    const context = setup({ windowLabel: 'note-1', bootstrap: BOOT })
    context.session.boot()
    await expect.poll(() => context.session.getState().services).toEqual({ id: 1 })
    expect(context.built.map(({ role, session }) => [role, session.indexGeneration])).toEqual([
      ['note-window', 5],
    ])
  })

  it('builds no services without an index session', async () => {
    const context = await bootDesktop({ indexOpenFails: true })
    await context.session.openRecent('/a')
    expect(context.session.getState()).toMatchObject({ status: 'ready', services: null })
    expect(context.built).toEqual([])
  })
})

describe('GraphSessionService index reactions', () => {
  it('drops the note-row overlays when a graph is released', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    context.noteRows.setOverlay('notes/a.md', 1, { gistStale: true })
    await context.session.openRecent('/b')
    expect(context.noteRows.getOverlay('notes/a.md', 1)).toBeNull()

    context.noteRows.setOverlay('notes/b.md', 2, { gistStale: true })
    await context.session.chooseGraph()
    expect(context.noteRows.getOverlay('notes/b.md', 2)).toBeNull()
  })

  it('reloads the open documents after a sync pass, not after a rebuild', async () => {
    const context = await bootDesktop()
    await context.session.openRecent('/a')
    await expect.poll(() => context.reloads).toHaveLength(1)

    await context.indexLifecycle.rebuildVisibly(1)
    expect(context.reloads).toHaveLength(1)
  })

  it('follows healed moves and requests downloads for stale placeholders', async () => {
    const context = setup()
    const onMoved = vi.spyOn(context.indexLifecycle, 'onMoved')
    const onStale = vi.spyOn(context.indexLifecycle, 'onStalePlaceholders')
    const stop = context.session.boot()

    onMoved.mock.calls[0]?.[0]('notes/a.md', 'notes/b.md')
    onStale.mock.calls[0]?.[0](['notes/evicted.md'])

    expect(context.healedMoves).toEqual([['notes/a.md', 'notes/b.md']])
    expect(context.icloudNative.calls()).toContainEqual({
      method: 'requestDownloads',
      args: [['notes/evicted.md']],
    })
    stop()
  })

  it('stops reacting to the index once the boot is stopped', async () => {
    const context = await bootDesktop()
    context.stop()
    await context.session.openRecent('/a')
    await settleIndex(context)
    expect(context.reloads).toEqual([])
  })
})
