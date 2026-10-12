import { describe, expect, it } from 'vitest'
import type { ICloudDownloadServiceOptions } from '@reflect/core'
import { createTestAppServices } from '@reflect/core/testing'
import { renderHookInApp, type RenderInAppOptions } from '@/test-utils/render-in-app.tsx'
import { useICloudRefresh } from './use-icloud-refresh.ts'

/** Mount the hook over a download factory that hands out scripted services, recorded in order. */
async function setup(options?: Pick<RenderInAppOptions, 'graph' | 'mobile'>) {
  const created: Array<{ options: ICloudDownloadServiceOptions; calls: string[] }> = []
  const app = createTestAppServices({
    icloudDownloads: {
      create: (downloadOptions) => {
        const calls: string[] = []
        created.push({ options: downloadOptions, calls })
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
  const hook = await renderHookInApp(() => useICloudRefresh(), {
    app,
    graph: { root: '/iCloud/Documents' },
    mobile: { kind: 'icloud' },
    ...options,
  })
  return { ...hook, created }
}

describe('useICloudRefresh', () => {
  it('is inert for local graphs', async () => {
    const { created } = await setup({ graph: { root: '/Documents' }, mobile: { kind: 'local' } })

    expect(created).toEqual([])
  })

  it('starts one download service for the open iCloud graph', async () => {
    const { created, app } = await setup()

    expect(created).toHaveLength(1)
    expect(created[0]?.options).toEqual({
      root: '/iCloud/Documents',
      refreshIndex: app.graphSession.refreshIndex,
    })
    expect(created[0]?.calls).toEqual(['start'])
  })

  it('disposes the service on unmount', async () => {
    const { created, unmount } = await setup()
    await unmount()

    expect(created[0]?.calls).toEqual(['start', 'dispose'])
  })

  it('replaces the service when another iCloud graph opens', async () => {
    const { created, app, act } = await setup()

    await act(() => app.graphSession.setGraph({ root: '/iCloud/Other' }))

    expect(created.map((entry) => entry.options.root)).toEqual([
      '/iCloud/Documents',
      '/iCloud/Other',
    ])
    expect(created[0]?.calls).toEqual(['start', 'dispose'])
    expect(created[1]?.calls).toEqual(['start'])
  })
})
