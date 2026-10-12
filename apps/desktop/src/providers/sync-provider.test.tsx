import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import type { BackupServiceOptions, GraphInfo, ICloudSyncServiceOptions } from '@reflect/core'
import {
  createTestAppServices,
  createTestBackupService,
  createTestICloudSyncService,
  type TestBackupService,
  type TestICloudSyncService,
} from '@reflect/core/testing'
import { renderWithServices } from '@/test-utils/render-with-services.tsx'
import { SyncProvider, useSync } from './sync-provider.tsx'

const graphState = vi.hoisted(() => ({ indexGeneration: 5 as number | null }))
vi.mock('@/providers/graph-provider.tsx', () => ({ useGraph: () => graphState }))

const GRAPH: GraphInfo = { root: '/g', name: 'G', generation: 3 }
const ICLOUD_GRAPH: GraphInfo = {
  root: '/Users/alex/Library/Mobile Documents/iCloud~app/Documents/Notes',
  name: 'Notes',
  generation: 4,
}

function Probe(): ReactElement {
  const sync = useSync()
  return (
    <button type="button" onClick={() => void sync.backUpNow().catch(() => {})}>
      {sync.backup.phase}
    </button>
  )
}

/** App services whose backup factory hands out scripted services, recorded in order. */
function setup() {
  const created: Array<{ options: BackupServiceOptions; service: TestBackupService }> = []
  const icloud: Array<{ options: ICloudSyncServiceOptions; service: TestICloudSyncService }> = []
  const app = createTestAppServices({
    icloudSyncs: {
      create: (options) => {
        const service = createTestICloudSyncService()
        icloud.push({ options, service })
        return service
      },
    },
    backups: {
      create: (options) => {
        const service = createTestBackupService()
        created.push({ options, service })
        return service
      },
    },
  })
  return { app, created, icloud }
}

describe('SyncProvider', () => {
  it('creates and starts one backup service for the graph and index session', async () => {
    const { app, created } = setup()
    await renderWithServices(
      <SyncProvider graph={GRAPH}>
        <Probe />
      </SyncProvider>,
      { app },
    )

    await vi.waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]?.options).toEqual({ generation: 3, indexGeneration: 5 })
    expect(created[0]?.service.calls()).toEqual([{ method: 'start' }])
    await expect.element(page.getByRole('button', { name: 'loading' })).toBeVisible()
  })

  it('publishes the service state and passes actions through', async () => {
    const { app, created } = setup()
    await renderWithServices(
      <SyncProvider graph={GRAPH}>
        <Probe />
      </SyncProvider>,
      { app },
    )
    await vi.waitFor(() => expect(created).toHaveLength(1))

    created[0]?.service.setState({ phase: 'disconnected' })
    await page.getByRole('button', { name: 'disconnected' }).click()

    expect(created[0]?.service.calls()).toEqual([{ method: 'start' }, { method: 'backUpNow' }])
  })

  it('disposes the service when it unmounts', async () => {
    const { app, created } = setup()
    const screen = await renderWithServices(
      <SyncProvider graph={GRAPH}>
        <Probe />
      </SyncProvider>,
      { app },
    )
    await vi.waitFor(() => expect(created).toHaveLength(1))

    await screen.unmount()

    expect(created[0]?.service.calls().at(-1)).toEqual({ method: 'dispose' })
  })

  it('mounts no iCloud sync for a graph outside iCloud Drive', async () => {
    const { app, created, icloud } = setup()
    await renderWithServices(
      <SyncProvider graph={GRAPH}>
        <Probe />
      </SyncProvider>,
      { app },
    )
    await vi.waitFor(() => expect(created).toHaveLength(1))

    expect(icloud).toEqual([])
  })

  it('runs one iCloud sync service for an iCloud graph and index session', async () => {
    const { app, icloud } = setup()
    const screen = await renderWithServices(
      <SyncProvider graph={ICLOUD_GRAPH}>
        <Probe />
      </SyncProvider>,
      { app },
    )

    await vi.waitFor(() => expect(icloud).toHaveLength(1))
    expect(icloud[0]?.options).toEqual({
      root: ICLOUD_GRAPH.root,
      generation: 4,
      indexGeneration: 5,
      metadataWatch: false,
    })
    expect(icloud[0]?.service.calls()).toEqual(['start'])

    await screen.unmount()

    expect(icloud[0]?.service.calls()).toEqual(['start', 'dispose'])
  })
})
