import type { ReactNode } from 'react'
import { cleanup, renderHook } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ICloudDownloadServiceOptions } from '@reflect/core'
import {
  createTestAppServices,
  createTestIpcBridgeService,
  installTestBridge,
} from '@reflect/core/testing'
import { AppServicesProvider } from '@/services/services-provider.tsx'
import { useICloudRefresh } from './use-icloud-refresh.ts'

const graphState = vi.hoisted<{
  current: {
    graph: { root: string } | null
    mobileStorageKind: 'icloud' | 'local' | null
    refreshIndex: () => void
  }
}>(() => ({
  current: { graph: null, mobileStorageKind: null, refreshIndex: () => {} },
}))
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => graphState.current,
}))

function refreshIndex(): void {}

let uninstallBridge: () => void = () => {}

beforeEach(() => {
  graphState.current = {
    graph: { root: '/iCloud/Documents' },
    mobileStorageKind: 'icloud',
    refreshIndex,
  }
  uninstallBridge = installTestBridge(createTestIpcBridgeService())
})

afterEach(async () => {
  await cleanup()
  uninstallBridge()
})

/** App services whose download factory hands out scripted services, recorded in order. */
function setup() {
  const created: Array<{ options: ICloudDownloadServiceOptions; calls: string[] }> = []
  const app = createTestAppServices({
    icloudDownloads: {
      create: (options) => {
        const calls: string[] = []
        created.push({ options, calls })
        return {
          start: () => {
            calls.push('start')
          },
          dispose: () => {
            calls.push('dispose')
          },
        }
      },
    },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppServicesProvider services={app}>{children}</AppServicesProvider>
  )
  return { created, wrapper }
}

describe('useICloudRefresh', () => {
  it('is inert for local graphs', async () => {
    graphState.current = {
      graph: { root: '/Documents' },
      mobileStorageKind: 'local',
      refreshIndex,
    }
    const { created, wrapper } = setup()
    await renderHook(() => useICloudRefresh(), { wrapper })

    expect(created).toEqual([])
  })

  it('is inert until the bridge is installed', async () => {
    uninstallBridge()
    const { created, wrapper } = setup()
    await renderHook(() => useICloudRefresh(), { wrapper })

    expect(created).toEqual([])
  })

  it('starts one download service for the open iCloud graph', async () => {
    const { created, wrapper } = setup()
    await renderHook(() => useICloudRefresh(), { wrapper })

    expect(created).toHaveLength(1)
    expect(created[0]?.options).toEqual({ root: '/iCloud/Documents', refreshIndex })
    expect(created[0]?.calls).toEqual(['start'])
  })

  it('disposes the service on unmount', async () => {
    const { created, wrapper } = setup()
    const { unmount } = await renderHook(() => useICloudRefresh(), { wrapper })
    await unmount()

    expect(created[0]?.calls).toEqual(['start', 'dispose'])
  })

  it('replaces the service when another iCloud graph opens', async () => {
    const { created, wrapper } = setup()
    const { rerender } = await renderHook(() => useICloudRefresh(), { wrapper })

    graphState.current = { ...graphState.current, graph: { root: '/iCloud/Other' } }
    await rerender()

    expect(created.map((entry) => entry.options.root)).toEqual([
      '/iCloud/Documents',
      '/iCloud/Other',
    ])
    expect(created[0]?.calls).toEqual(['start', 'dispose'])
    expect(created[1]?.calls).toEqual(['start'])
  })
})
