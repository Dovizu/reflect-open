import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { page } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  setDefaultKeyboard,
  type BackupState,
  type ConflictedNote,
  type GraphInfo,
  type KeyboardService,
} from '@reflect/core'
import {
  createTestAppServices,
  createTestIpcBridgeService,
  createTestKeyboardService,
  installTestBridge,
} from '@reflect/core/testing'
import { renderWithServices } from '@/test-utils/render-with-services.tsx'
import { SyncStatusPill } from './sync-status-pill.tsx'

/**
 * The floating status pill (Plan 19, step 10): visible only when sync has
 * something to say, plain language only, and it yields to the keyboard.
 */

const graphState = vi.hoisted(() => ({
  graph: { root: '/g', name: 'G', generation: 3 } as GraphInfo | null,
}))
vi.mock('@/providers/graph-provider.tsx', () => ({ useGraph: () => graphState }))

const sync = vi.hoisted(() => ({ backup: { phase: 'loading' } as BackupState }))
vi.mock('@/providers/sync-provider.tsx', () => ({
  useSyncContext: () => ({ backup: sync.backup }),
}))

function connected(status: Extract<BackupState, { phase: 'connected' }>['status']): BackupState {
  return {
    phase: 'connected',
    remoteUrl: 'https://github.com/alex/notes.git',
    repo: { owner: 'alex', name: 'notes' },
    status,
  }
}

let queryClient: QueryClient
let keyboard: KeyboardService
/** Answers the index's conflicted-note read. */
let conflictedNotes: () => Promise<ConflictedNote[]>
let uninstallBridge: () => void = () => {}

beforeEach(() => {
  keyboard = createTestKeyboardService()
  setDefaultKeyboard(keyboard)
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  sync.backup = connected({ state: 'idle' })
  conflictedNotes = async () => []
  uninstallBridge = installTestBridge(createTestIpcBridgeService())
})

afterEach(() => {
  queryClient.clear()
  setDefaultKeyboard(null)
  uninstallBridge()
})

async function mount(): Promise<void> {
  const base = createTestAppServices()
  const app = createTestAppServices({
    indexQuery: { ...base.indexQuery, getConflictedNotes: () => conflictedNotes() },
  })
  await renderWithServices(
    <QueryClientProvider client={queryClient}>
      <SyncStatusPill />
    </QueryClientProvider>,
    { app },
  )
}

describe('SyncStatusPill', () => {
  it('hides in the quiet Backed up state', async () => {
    await mount()

    await Promise.resolve()
    await expect.element(page.getByRole('status')).not.toBeInTheDocument()
  })

  it('shows Syncing while a cycle runs', async () => {
    sync.backup = connected({ state: 'syncing' })
    await mount()

    await expect.element(page.getByRole('status')).toMatchTextContent('Syncing')
  })

  it('claims nothing until the conflict count is known', async () => {
    // A pill shown before the count resolves could flip from hidden
    // (reads as Backed up) to Needs review.
    sync.backup = connected({ state: 'offline', message: 'Offline' })
    conflictedNotes = () => new Promise(() => {})
    await mount()

    await Promise.resolve()
    await expect.element(page.getByRole('status')).not.toBeInTheDocument()
  })

  it('still shows engine states when the conflict count fails to load', async () => {
    // Loading hides; a failed count must not — Offline/Needs attention are
    // engine truth and would otherwise blank forever.
    sync.backup = connected({ state: 'offline', message: 'Offline' })
    conflictedNotes = async () => {
      throw new Error('index unavailable')
    }
    await mount()

    await expect.element(page.getByRole('status')).toMatchTextContent('Offline')
  })

  it('shows Needs review while conflicted notes exist', async () => {
    conflictedNotes = async () => [{ path: 'notes/a.md', title: 'A' }]
    await mount()

    await expect.element(page.getByRole('status')).toMatchTextContent('Needs review')
  })

  it('yields to the software keyboard', async () => {
    sync.backup = connected({ state: 'syncing' })
    keyboard.publish(300)
    await mount()

    await Promise.resolve()
    await expect.element(page.getByRole('status')).not.toBeInTheDocument()
  })
})
