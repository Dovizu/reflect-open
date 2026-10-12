import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from 'vitest-browser-react'
import { page, type Locator } from 'vitest/browser'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReflectError,
  setDefaultICloudNative,
  setDefaultPlatform,
  type GraphInfo,
} from '@reflect/core'
import { createTestICloudNativeService, createTestPlatformService } from '@reflect/core/testing'
import type { BackupState } from '@reflect/core'
import '@/test-utils/locator.ts'
import { RouterProvider, useRouter } from '@/routing/router.tsx'
import { SyncSection } from './sync-section.tsx'
import { installTestLinkNavigation } from '@/test-utils/link-navigation.ts'
import { deepLinkForRoute } from '@/lib/deep-links/format.ts'

const { openNoteWindow } = installTestLinkNavigation()

const core = vi.hoisted(() => ({
  status: {
    available: true,
    documentsRoot: '/Users/alex/Library/Mobile Documents/iCloud~app/Documents',
    existingGraphRoots: [] as string[],
  },
  pendingNotes: 0,
  conflictedNotes: [] as Array<{ path: string; title: string }>,
  duplicateIds: [] as Array<{ id: string; paths: string[] }>,
}))

const graph = vi.hoisted(() => ({
  current: null as GraphInfo | null,
  openRecent: vi.fn<(root: string) => Promise<boolean>>(async () => true),
}))

const sync = vi.hoisted(() => ({
  backup: { phase: 'disconnected' } as BackupState,
  disconnectGraph: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  backUpNow: vi.fn(async () => {}),
}))

vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  hasBridge: () => true,
  icloudStatus: vi.fn(async () => core.status),
  icloudPendingCount: vi.fn(async () => core.pendingNotes),
  getConflictedNotes: vi.fn(async () => core.conflictedNotes),
  getDuplicateNoteIds: vi.fn(async () => core.duplicateIds),
}))
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({ graph: graph.current, openRecent: graph.openRecent }),
}))
vi.mock('@/providers/sync-provider.tsx', () => ({ useSync: () => sync }))

async function renderSection(): Promise<void> {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider initialRoute={{ kind: 'settings' }}>
        <SyncSection />
        <RouteProbe />
      </RouterProvider>
    </QueryClientProvider>,
  )
}

function RouteProbe(): ReactElement {
  const { route } = useRouter()
  return <output data-testid="route">{route.kind === 'note' ? route.path : route.kind}</output>
}

function legend(section: Locator, text: string): Locator {
  return section.locate('legend').filter({ hasText: text })
}

beforeEach(() => {
  setDefaultPlatform(createTestPlatformService())
  graph.current = {
    root: '/Users/alex/Documents/Notes',
    name: 'Notes',
    generation: 1,
  }
  core.status = {
    available: true,
    documentsRoot: '/Users/alex/Library/Mobile Documents/iCloud~app/Documents',
    existingGraphRoots: ['/Users/alex/Library/Mobile Documents/iCloud~app/Documents/Personal'],
  }
  core.pendingNotes = 0
  core.conflictedNotes = []
  core.duplicateIds = []
  sync.backup = { phase: 'disconnected' }
})

afterEach(() => {
  setDefaultPlatform(null)
  setDefaultICloudNative(null)
  vi.clearAllMocks()
})

describe('SyncSection', () => {
  it('combines iCloud Drive and GitHub sync under Sync for local graphs', async () => {
    await renderSection()

    const section = page.getByRole('region', { name: 'Sync' })
    await expect.element(legend(section, 'iCloud Drive')).toBeInTheDocument()
    await expect.element(section.getByText('1 graph in iCloud Drive.')).toBeInTheDocument()
    await expect.element(legend(section, 'GitHub sync')).toBeInTheDocument()
    await expect
      .element(section.getByRole('button', { name: /connect github/i }))
      .toBeInTheDocument()
  })

  it('keeps GitHub sync visible when the graph syncs through iCloud', async () => {
    graph.current = {
      root: '/Users/alex/Library/Mobile Documents/iCloud~app/Documents/Notes',
      name: 'Notes',
      generation: 1,
    }

    await renderSection()

    const section = page.getByRole('region', { name: 'Sync' })
    await expect.element(legend(section, 'iCloud Drive')).toBeInTheDocument()
    await expect.element(section.getByText('All note files are downloaded.')).toBeInTheDocument()
    await expect.element(section.getByText('No notes need review.')).toBeInTheDocument()
    await expect.element(legend(section, 'GitHub sync')).toBeInTheDocument()
    await expect
      .element(section.getByRole('button', { name: /connect github/i }))
      .toBeInTheDocument()
  })

  it('surfaces iCloud download and review counts', async () => {
    graph.current = {
      root: '/Users/alex/Library/Mobile Documents/iCloud~app/Documents/Notes',
      name: 'Notes',
      generation: 1,
    }
    core.pendingNotes = 2
    core.conflictedNotes = [{ path: 'notes/a.md', title: 'A' }]
    core.duplicateIds = [{ id: 'note-1', paths: ['notes/a.md', 'notes/a 2.md'] }]

    await renderSection()

    const section = page.getByRole('region', { name: 'Sync' })
    await expect
      .element(section.getByText('2 notes are still downloading from iCloud.'))
      .toBeInTheDocument()
    await expect.element(section.getByText('1 note needs review, 1 sync fork')).toBeInTheDocument()
    await expect
      .element(section.getByRole('button', { name: /A.*notes\/a\.md/ }))
      .toBeInTheDocument()
  })

  it('opens the conflicted note listed under GitHub sync', async () => {
    core.conflictedNotes = [{ path: 'notes/conflicted.md', title: 'Conflicted note' }]
    sync.backup = {
      phase: 'connected',
      remoteUrl: 'https://github.com/alex/notes.git',
      repo: { owner: 'alex', name: 'notes' },
      status: { state: 'idle' },
    }

    await renderSection()

    const section = page.getByRole('region', { name: 'Sync' })
    await section.getByRole('button', { name: /Conflicted note.*notes\/conflicted\.md/ }).click()

    await expect.element(page.getByTestId('route')).toMatchTextContent('notes/conflicted.md')
  })

  it('opens a ⌘-clicked conflicted note in a new window', async () => {
    core.conflictedNotes = [{ path: 'notes/conflicted.md', title: 'Conflicted note' }]
    sync.backup = {
      phase: 'connected',
      remoteUrl: 'https://github.com/alex/notes.git',
      repo: { owner: 'alex', name: 'notes' },
      status: { state: 'idle' },
    }

    await renderSection()

    const section = page.getByRole('region', { name: 'Sync' })
    await section
      .getByRole('button', { name: /Conflicted note.*notes\/conflicted\.md/ })
      .click({ modifiers: ['ControlOrMeta'] })

    await vi.waitFor(() =>
      expect(openNoteWindow).toHaveBeenCalledWith(
        deepLinkForRoute({
          kind: 'note',
          path: 'notes/conflicted.md',
        }),
      ),
    )
    expect(page.getByTestId('route').element().textContent).toBe('settings')
  })
})

describe('moving a graph to iCloud', () => {
  const NEW_ROOT = '/Users/alex/Library/Mobile Documents/iCloud~app/Documents/Notes'

  /** Confirm the move dialog; `copyFails` makes the native copy reject. */
  async function confirmMove(options?: { copyFails?: boolean }): Promise<Locator> {
    setDefaultICloudNative(
      createTestICloudNativeService({
        status: options?.copyFails === true ? { available: false } : core.status,
      }),
    )
    await renderSection()
    const section = page.getByRole('region', { name: 'Sync' })
    await section.getByRole('button', { name: 'Move graph to iCloud…' }).click()
    await page.getByRole('button', { name: 'Move to iCloud' }).click()
    return section
  }

  it('copies the graph, disconnects the backup, and reopens it in iCloud', async () => {
    sync.backup = {
      phase: 'connected',
      remoteUrl: 'https://github.com/alex/notes.git',
      repo: { owner: 'alex', name: 'notes' },
      status: { state: 'idle' },
    }

    await confirmMove()

    await vi.waitFor(() => expect(graph.openRecent).toHaveBeenCalledWith(NEW_ROOT))
    expect(sync.disconnectGraph).toHaveBeenCalledOnce()
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
  })

  it('leaves a disconnected backup alone', async () => {
    await confirmMove()

    await vi.waitFor(() => expect(graph.openRecent).toHaveBeenCalledWith(NEW_ROOT))
    expect(sync.disconnectGraph).not.toHaveBeenCalled()
  })

  it('reports a backup that could not be disconnected and a graph that did not reopen', async () => {
    sync.backup = {
      phase: 'connected',
      remoteUrl: 'https://github.com/alex/notes.git',
      repo: { owner: 'alex', name: 'notes' },
      status: { state: 'idle' },
    }
    sync.disconnectGraph.mockRejectedValueOnce(new ReflectError('io', 'remote locked'))
    graph.openRecent.mockResolvedValueOnce(false)

    const section = await confirmMove()

    await expect
      .element(
        section.getByText(
          'The graph moved to iCloud, but GitHub sync could not be disconnected from the original folder: remote locked The copy landed in iCloud but could not be opened — open it from Saved graphs.',
        ),
      )
      .toBeInTheDocument()
  })

  it('keeps the dialog open and reports a copy that failed', async () => {
    await confirmMove({ copyFails: true })

    await expect
      .element(page.getByText('test iCloud: the container is unavailable'))
      .toBeInTheDocument()
    await expect.element(page.getByRole('dialog')).toBeInTheDocument()
    expect(graph.openRecent).not.toHaveBeenCalled()
  })
})

describe('SyncSection off macOS desktop', () => {
  it('keeps backup visible when the iCloud row is platform-hidden', async () => {
    setDefaultPlatform(createTestPlatformService({ isMacosDesktop: false }))
    graph.current = {
      root: '/Users/alex/Library/Mobile Documents/iCloud~app/Documents/Notes',
      name: 'Notes',
      generation: 1,
    }
    core.status = {
      available: true,
      documentsRoot: '/Users/alex/Library/Mobile Documents/iCloud~app/Documents',
      existingGraphRoots: [],
    }
    await renderSection()

    const section = page.getByRole('region', { name: 'Sync' })
    expect(legend(section, 'iCloud Drive').query()).toBeNull()
    await expect.element(legend(section, 'GitHub sync')).toBeInTheDocument()
  })
})
