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
 * The graph session and the mobile onboarding are covered in `@reflect/core`.
 * These cover the provider as their React shell.
 */

let invokeLog: string[]
/** Pending `graph_open` resolvers keyed by requested root. */
let pendingOpens: Map<string, () => void>
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
/** A fresh QueryClient per test — the settings provider reads through it. */
let queryClient: QueryClient

/** The fixed mobile roots the fake `mobile_storage` reports. */
const MOBILE_ROOT = '/Documents'
const ICLOUD_ROOT = '/iCloud/Documents'

function installFakeBridge(): void {
  invokeLog = []
  pendingOpens = new Map()
  storedRecents = []
  storedFiles = []
  metaStore = {}
  settingsStore = {}
  storedStorage = { localRoot: MOBILE_ROOT, icloudDocumentsRoot: ICLOUD_ROOT, icloudGraphRoots: [] }
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
  it('boots the mobile onboarding over the process-wide services', async () => {
    const { result } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))
    expect(result.current.status).toBe('choosing')
    expect(result.current.graph).toBeNull()
    await vi.waitFor(() =>
      expect(result.current.mobileStorageInfo).toEqual({
        localRoot: MOBILE_ROOT,
        icloudDocumentsRoot: ICLOUD_ROOT,
        icloudGraphRoots: [],
      }),
    )
    expect(result.current.mobileStorageResolving).toBe(false)
    expect(invokeLog).not.toContain(`graph_open:${MOBILE_ROOT}`)
  })

  it('publishes the app’s mobile onboarding and passes completeOnboarding through', async () => {
    const app = createTestAppServices({
      platform: createTestPlatformService({ appPlatform: 'ios' }),
    })
    const { result, act } = await renderHook(() => useGraph(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AppServicesProvider services={app}>
          <QueryClientProvider client={queryClient}>
            <SettingsProvider>
              <GraphProvider platform="ios">{children}</GraphProvider>
            </SettingsProvider>
          </QueryClientProvider>
        </AppServicesProvider>
      ),
    })
    await vi.waitFor(() => expect(result.current.needsOnboarding).toBe(true))
    await vi.waitFor(() => expect(result.current.mobileStorageResolving).toBe(false))

    await act(async () => {
      await result.current.completeOnboarding('local')
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.needsOnboarding).toBe(false)
    expect(result.current.graph?.root).toBe('/local/Documents')
    expect(result.current.mobileStorageKind).toBe('local')
    expect(app.mobileOnboarding.getState().kind).toBe('local')
    await vi.waitFor(() => expect(app.settings.saves().at(-1)?.mobileOnboarded).toBe(true))
  })
})
