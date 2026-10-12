import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook } from 'vitest-browser-react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createConsoleLogger,
  createSingleWindowHost,
  createWindowService,
  currentIpc,
  setBridge,
  setDefaultDialog,
  setDefaultPlatform,
  setDefaultWindow,
  setDefaultSettings,
} from '@reflect/core'
import {
  createTestAppServices,
  createTestDialogService,
  createTestPlatformService,
  type TestAppServices,
  type TestDialogService,
} from '@reflect/core/testing'
import { AppServicesProvider, useGraphServices } from '@/services/services-provider.tsx'
import { GraphProvider, useGraph } from './graph-provider.tsx'
import { SettingsProvider } from './settings-provider.tsx'

beforeEach(() => {
  setDefaultPlatform(
    createTestPlatformService({ isMacosDesktop: false, hasMacosTitleBarOverlay: false }),
  )
})

afterEach(() => {
  setDefaultPlatform(null)
})

/**
 * The graph session itself is covered in `@reflect/core`. These cover the
 * provider as its React shell, and the mobile bootstrap hook that still lives
 * beside it.
 */

let invokeLog: string[]
/** Pending `graph_open` resolvers keyed by requested root. */
let pendingOpens: Map<string, () => void>
let failOpens: boolean
/** What `recent_graphs` returns — set before render to simulate prior opens. */
let storedRecents: Array<{ root: string; name: string; openedMs: number }>
/** What `list_files` returns — set before render to simulate existing notes. */
let storedFiles: Array<{ path: string; size: number; modifiedMs: number }>
/** The fake `index_meta` table (the welcome marker lives here). */
let metaStore: Record<string, string>
/** The fake settings document (`mobileOnboarded`/`mobileStorage` live here). */
let settingsStore: Record<string, unknown>
/** What the fake `mobile_storage` resolves to — set before render. */
let storedStorage: {
  localRoot: string
  icloudDocumentsRoot: string | null
  icloudGraphRoots: string[]
}
/** When set, `mobile_storage` stays pending until {@link releaseStorage}. */
let storageHangs: boolean
let releaseStorage: () => void
/** A fresh QueryClient per test — the settings provider reads through it. */
let queryClient: QueryClient

/** The fixed mobile roots the fake `mobile_storage` reports. */
const MOBILE_ROOT = '/Documents'
const ICLOUD_ROOT = '/iCloud/Documents'
/** Where a fresh iCloud graph is created when the container is empty. */
const ICLOUD_GRAPH = `${ICLOUD_ROOT}/Notes`

function installFakeBridge(): void {
  invokeLog = []
  pendingOpens = new Map()
  failOpens = false
  storedRecents = []
  storedFiles = []
  metaStore = {}
  settingsStore = {}
  storedStorage = { localRoot: MOBILE_ROOT, icloudDocumentsRoot: ICLOUD_ROOT, icloudGraphRoots: [] }
  storageHangs = false
  releaseStorage = () => {}
  let generation = 0
  setBridge({
    invoke: async (command, args) => {
      invokeLog.push(
        command === 'graph_open' || command === 'graph_create'
          ? `${command}:${String(args['path'])}`
          : command,
      )
      switch (command) {
        case 'graph_create': {
          const root = String(args['path'])
          generation += 1
          return { root, name: root.split('/').findLast(Boolean) ?? '', generation }
        }
        case 'graph_open': {
          if (failOpens) {
            throw { kind: 'io', message: 'cannot open graph' }
          }
          const root = String(args['path'])
          await new Promise<void>((resolve) => {
            pendingOpens.set(root, resolve)
          })
          generation += 1
          return { root, name: root.split('/').findLast(Boolean) ?? '', generation }
        }
        case 'recent_graphs':
          return storedRecents
        case 'forget_recent':
          storedRecents = storedRecents.filter((recent) => recent.root !== String(args['root']))
          return null
        case 'mobile_storage':
          if (storageHangs) {
            await new Promise<void>((resolve) => {
              releaseStorage = resolve
            })
          }
          return storedStorage
        case 'mobile_storage_local':
          return storedStorage.localRoot
        case 'settings_load':
          return settingsStore
        case 'settings_save':
          settingsStore = args['settings'] as Record<string, unknown>
          return null
        case 'index_open':
          return generation
        case 'list_files':
          return storedFiles
        case 'vault_scan_stats':
          return { notes: storedFiles.length, attachments: 0, skipped: 0 }
        case 'index_meta_set':
          metaStore[String(args['key'])] = String(args['value'])
          return null
        case 'db_query': {
          // The only meta read the provider issues is the welcome marker.
          const sql = String(args['sql'] ?? '')
          if (/index_?meta/i.test(sql)) {
            const key = String((args['params'] as unknown[])?.[0])
            return key in metaStore ? [{ value: metaStore[key] }] : []
          }
          return []
        }
        default:
          return null
      }
    },
    listen: async () => () => {},
  })
}

function resolveOpen(root: string): void {
  pendingOpens.get(root)?.()
  pendingOpens.delete(root)
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <GraphProvider>{children}</GraphProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

function mobileWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <GraphProvider platform="ios">{children}</GraphProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

let dialog: TestDialogService

beforeEach(() => {
  installFakeBridge()
  setDefaultSettings(null)
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  dialog = createTestDialogService()
  setDefaultDialog(dialog)
  // A desktop shell with note windows, so a graph switch closes them over the fake bridge.
  setDefaultWindow(
    createWindowService({
      ipc: currentIpc(),
      host: { ...createSingleWindowHost(), multiWindow: true },
      logger: createConsoleLogger(),
    }),
  )
})

afterEach(() => {
  setBridge(null)
  setDefaultSettings(null)
})

describe('GraphProvider over the process-wide services', () => {
  it('starts at the chooser when there are no recents', async () => {
    const { result } = await renderHook(() => useGraph(), { wrapper })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))
    expect(result.current.graph).toBeNull()
  })

  it('returns to the graph chooser without opening the folder picker', async () => {
    storedRecents = [{ root: '/known', name: 'known', openedMs: 1 }]
    const { result, act } = await renderHook(() => useGraph(), { wrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has('/known')).toBe(true))
      resolveOpen('/known')
    })
    await vi.waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.chooseGraph()
    })

    expect(result.current.status).toBe('choosing')
    expect(result.current.graph).toBeNull()
    expect(result.current.indexGeneration).toBeNull()
    expect(dialog.calls()).toEqual([])
    expect(result.current.recents).toEqual(storedRecents)
  })

  it('opens a picked folder and seeds the empty graph', async () => {
    dialog.setFolder('/fresh')
    const { result, act } = await renderHook(() => useGraph(), { wrapper })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    await act(async () => {
      const picking = result.current.pickAndOpen()
      await vi.waitFor(() => expect(pendingOpens.has('/fresh')).toBe(true))
      resolveOpen('/fresh')
      await picking
    })

    expect(result.current.status).toBe('ready')
    expect(invokeLog).toContain('note_write')
    expect(metaStore['welcomeSeeded']).toBe('true')
  })
})

describe('GraphProvider inside an AppServicesProvider', () => {
  function servicesWrapper(app: TestAppServices) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <AppServicesProvider services={app}>
          <QueryClientProvider client={queryClient}>
            <SettingsProvider>
              <GraphProvider>{children}</GraphProvider>
            </SettingsProvider>
          </QueryClientProvider>
        </AppServicesProvider>
      )
    }
  }

  it('boots the app’s graph session and passes its actions through', async () => {
    const app = createTestAppServices()
    const { result, act } = await renderHook(() => useGraph(), { wrapper: servicesWrapper(app) })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    await act(async () => {
      await result.current.openRecent('/a')
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.graph).toEqual({ root: '/a', name: 'a', generation: 1 })
    expect(result.current.indexGeneration).toBe(1)
    expect(app.graphSession.getState().graph?.root).toBe('/a')
    // The session lives in the service, not in the provider: no bridge call.
    expect(invokeLog).toEqual([])
  })

  it('provides the open session’s graph services', async () => {
    function SessionRoot() {
      const { session, role } = useGraphServices()
      return (
        <p>
          {role} {session.root}
        </p>
      )
    }
    function Probe() {
      const { status, openRecent } = useGraph()
      if (status === 'ready') {
        return <SessionRoot />
      }
      return (
        <button
          type="button"
          disabled={status !== 'choosing'}
          onClick={() => void openRecent('/a')}
        >
          Open
        </button>
      )
    }
    const app = createTestAppServices()
    const Wrapper = servicesWrapper(app)
    const screen = await render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    )

    await screen.getByRole('button', { name: 'Open' }).click()

    await expect.element(screen.getByText('main /a')).toBeVisible()
    expect(app.graphSession.getState().session?.signal.aborted).toBe(false)
  })
})

describe('GraphProvider mobile onboarding (Plans 19/21)', () => {
  it('defers opening the fixed roots and shows onboarding on a fresh install', async () => {
    const { result } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))
    expect(result.current.status).toBe('choosing')
    expect(result.current.graph).toBeNull()
    expect(result.current.mobileStorageInfo).toEqual({
      localRoot: MOBILE_ROOT,
      icloudDocumentsRoot: ICLOUD_ROOT,
      icloudGraphRoots: [],
    })
    // The roots must stay untouched until the user chooses — the GitHub clone
    // path needs the local one empty (`git_clone` refuses a non-empty
    // directory), and opening the iCloud one would bootstrap + seed it.
    expect(invokeLog).not.toContain(`graph_open:${MOBILE_ROOT}`)
    expect(invokeLog).not.toContain(`graph_open:${ICLOUD_GRAPH}`)
    expect(invokeLog).not.toContain(`graph_create:${ICLOUD_GRAPH}`)
  })

  it('opens the local root and records flag + kind on completeOnboarding(local)', async () => {
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))

    await act(async () => {
      const done = result.current.completeOnboarding('local')
      await vi.waitFor(() => expect(pendingOpens.has(MOBILE_ROOT)).toBe(true))
      resolveOpen(MOBILE_ROOT)
      await done
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.needsOnboarding).toBe(false)
    expect(result.current.graph?.root).toBe(MOBILE_ROOT)
    expect(result.current.mobileStorageKind).toBe('local')
    // The gate is persisted (through the settings provider) so later launches
    // open the root directly — persistence trails the state update, so wait.
    await vi.waitFor(() => expect(settingsStore['mobileOnboarded']).toBe(true))
    expect(settingsStore['mobileStorage']).toBe('local')
  })

  it('defers the first mobile index pass while hidden and replays it on foreground', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    try {
      const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })
      await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))

      await act(async () => {
        const done = result.current.completeOnboarding('local')
        await vi.waitFor(() => expect(pendingOpens.has(MOBILE_ROOT)).toBe(true))
        resolveOpen(MOBILE_ROOT)
        await done
      })
      await vi.waitFor(() => expect(metaStore['welcomeSeeded']).toBe('true'))
      await act(async () => {
        await Promise.resolve()
      })

      expect(invokeLog).not.toContain('index_clear')
      expect(invokeLog).not.toContain('index_reconcile_scan')

      visibility.mockReturnValue('visible')
      await act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // Resume performs a full sync, which catches files and local events the
      // intentionally absent live subscription could not observe while hidden.
      await vi.waitFor(() => expect(invokeLog).toContain('index_clear'))
    } finally {
      visibility.mockRestore()
    }
  })

  it('creates the default container graph and records kind + name on completeOnboarding(icloud)', async () => {
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))

    await act(async () => {
      const done = result.current.completeOnboarding('icloud')
      await vi.waitFor(() => expect(pendingOpens.has(ICLOUD_GRAPH)).toBe(true))
      resolveOpen(ICLOUD_GRAPH)
      await done
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.graph?.root).toBe(ICLOUD_GRAPH)
    expect(result.current.mobileStorageKind).toBe('icloud')
    expect(invokeLog).toContain(`graph_create:${ICLOUD_GRAPH}`)
    await vi.waitFor(() => expect(settingsStore['mobileOnboarded']).toBe(true))
    expect(settingsStore['mobileStorage']).toBe('icloud')
    // WHICH graph is remembered by name — never by container path.
    expect(settingsStore['mobileGraphName']).toBe('Notes')
  })

  it('opens the explicitly chosen container graph and persists its name', async () => {
    storedStorage = {
      localRoot: MOBILE_ROOT,
      icloudDocumentsRoot: ICLOUD_ROOT,
      icloudGraphRoots: [`${ICLOUD_ROOT}/Notes`, `${ICLOUD_ROOT}/Work`],
    }
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))

    await act(async () => {
      const done = result.current.completeOnboarding('icloud', `${ICLOUD_ROOT}/Work`)
      await vi.waitFor(() => expect(pendingOpens.has(`${ICLOUD_ROOT}/Work`)).toBe(true))
      resolveOpen(`${ICLOUD_ROOT}/Work`)
      await done
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.graph?.root).toBe(`${ICLOUD_ROOT}/Work`)
    expect(invokeLog).not.toContain(`graph_create:${ICLOUD_ROOT}/Work`)
    await vi.waitFor(() => expect(settingsStore['mobileGraphName']).toBe('Work'))
  })

  it('creates an explicitly named iCloud graph when it is not already known', async () => {
    const journalRoot = `${ICLOUD_ROOT}/Journal`
    storedStorage = {
      localRoot: MOBILE_ROOT,
      icloudDocumentsRoot: ICLOUD_ROOT,
      icloudGraphRoots: [`${ICLOUD_ROOT}/Notes`],
    }
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))

    await act(async () => {
      const done = result.current.completeOnboarding('icloud', journalRoot)
      await vi.waitFor(() => expect(pendingOpens.has(journalRoot)).toBe(true))
      resolveOpen(journalRoot)
      await done
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(invokeLog).toContain(`graph_create:${journalRoot}`)
    await vi.waitFor(() => expect(settingsStore['mobileGraphName']).toBe('Journal'))
  })

  it('shows onboarding immediately while the iCloud container is still resolving', async () => {
    storageHangs = true
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    // Onboarding must not wait on the container lookup — on a fresh install
    // that call can take a long time, and it used to hold the whole app on a
    // bare "Loading…" screen.
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))
    expect(result.current.mobileStorageResolving).toBe(true)
    // The sandbox root seeds instantly so the on-device/GitHub paths work.
    await vi.waitFor(() => expect(result.current.mobileStorageInfo?.localRoot).toBe(MOBILE_ROOT))
    expect(result.current.mobileStorageInfo?.icloudDocumentsRoot).toBeNull()

    await act(() => {
      releaseStorage()
    })
    await vi.waitFor(() => expect(result.current.mobileStorageResolving).toBe(false))
    expect(result.current.mobileStorageInfo?.icloudDocumentsRoot).toBe(ICLOUD_ROOT)
  })

  it('rejects completeOnboarding(icloud) when iCloud is unavailable', async () => {
    storedStorage = { localRoot: MOBILE_ROOT, icloudDocumentsRoot: null, icloudGraphRoots: [] }
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))

    await act(async () => {
      await expect(result.current.completeOnboarding('icloud')).rejects.toThrow(
        /iCloud Drive isn’t available/,
      )
    })
    expect(result.current.needsOnboarding).toBe(true)
    expect(settingsStore['mobileOnboarded']).toBeUndefined()
  })

  it('keeps onboarding up (flag unset) when the open fails, for an in-app retry', async () => {
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))

    failOpens = true
    await act(async () => {
      await expect(result.current.completeOnboarding('local')).rejects.toThrow()
    })

    // Open failed → onboarding stays up (the screen surfaces the thrown error)
    // for an in-app retry, and the flag is never persisted — no way to get
    // stranded past onboarding on a broken open.
    expect(result.current.needsOnboarding).toBe(true)
    expect(result.current.graph).toBeNull()
    expect(settingsStore['mobileOnboarded']).toBeUndefined()
  })

  it('opens the local root directly when onboarded without a storage kind (pre-Plan-21 installs)', async () => {
    settingsStore = { mobileOnboarded: true }
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has(MOBILE_ROOT)).toBe(true))
      resolveOpen(MOBILE_ROOT)
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.needsOnboarding).toBe(false)
    expect(result.current.graph?.root).toBe(MOBILE_ROOT)
    expect(result.current.mobileStorageKind).toBe('local')
  })

  it('opens the first container graph when onboarded onto iCloud with no saved name (pre-multi-graph installs)', async () => {
    settingsStore = { mobileOnboarded: true, mobileStorage: 'icloud' }
    storedStorage = {
      localRoot: MOBILE_ROOT,
      icloudDocumentsRoot: ICLOUD_ROOT,
      icloudGraphRoots: [ICLOUD_GRAPH],
    }
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has(ICLOUD_GRAPH)).toBe(true))
      resolveOpen(ICLOUD_GRAPH)
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.graph?.root).toBe(ICLOUD_GRAPH)
    expect(result.current.mobileStorageKind).toBe('icloud')
  })

  it('opens the graph named in settings when the container holds several', async () => {
    settingsStore = { mobileOnboarded: true, mobileStorage: 'icloud', mobileGraphName: 'Work' }
    storedStorage = {
      localRoot: MOBILE_ROOT,
      icloudDocumentsRoot: ICLOUD_ROOT,
      icloudGraphRoots: [`${ICLOUD_ROOT}/Notes`, `${ICLOUD_ROOT}/Work`],
    }
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has(`${ICLOUD_ROOT}/Work`)).toBe(true))
      resolveOpen(`${ICLOUD_ROOT}/Work`)
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.graph?.root).toBe(`${ICLOUD_ROOT}/Work`)
  })

  it('parks on an honest error when the iCloud graph is unreachable (signed out)', async () => {
    settingsStore = { mobileOnboarded: true, mobileStorage: 'icloud' }
    storedStorage = { localRoot: MOBILE_ROOT, icloudDocumentsRoot: null, icloudGraphRoots: [] }
    const { result } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))
    // No silent fallback to the empty local root — that would look like the
    // user's notes vanished. The error names the fix instead.
    expect(result.current.needsOnboarding).toBe(false)
    expect(result.current.error).toMatch(/iCloud isn’t available/)
    expect(invokeLog).not.toContain(`graph_open:${MOBILE_ROOT}`)
  })
})
