import { describe, expect, it } from 'vitest'
import type { GraphInfo } from '@reflect/core'
import {
  createTestAppServices,
  createTestAssetDescriptionService,
  createTestSettingsService,
  createTestWindowService,
} from '@reflect/core/testing'
import { renderInApp } from '@/test-utils/render-in-app.tsx'
import { AssetDescribeProvider } from './asset-describe-provider.tsx'

const GRAPH: GraphInfo = { root: '/g', name: 'g', generation: 7 }

function tree(graph: GraphInfo = GRAPH) {
  return <AssetDescribeProvider graph={graph}>child</AssetDescribeProvider>
}

describe('AssetDescribeProvider', () => {
  it('opens and starts a session for the graph when automatic description is on', async () => {
    const app = createTestAppServices({
      settings: createTestSettingsService({ describeAssets: true }),
    })
    const view = await renderInApp(tree(), { app, servicesOnly: true })

    await expect.element(view.getByText('child')).toBeVisible()
    await expect
      .poll(() => app.assetDescription.sessions())
      .toEqual([{ generation: 7, starts: 1, schedules: 0, disposed: false }])
  })

  it('opens no session while automatic description is off', async () => {
    // Loaded before the first render: until the stored settings arrive the
    // provider sees the default, which is on.
    const settings = createTestSettingsService({ describeAssets: false })
    await settings.whenLoaded()
    const app = createTestAppServices({ settings })
    const view = await renderInApp(tree(), { app, servicesOnly: true })

    await expect.element(view.getByText('child')).toBeVisible()
    expect(app.assetDescription.sessions()).toEqual([])
  })

  it('disposes the session when the setting turns off, and on a new graph generation', async () => {
    const app = createTestAppServices({
      settings: createTestSettingsService({ describeAssets: true }),
    })
    const view = await renderInApp(tree(), { app, servicesOnly: true })
    await expect.poll(() => app.assetDescription.sessions()).toHaveLength(1)

    await view.rerender(tree({ ...GRAPH, generation: 8 }))
    await expect
      .poll(() => app.assetDescription.sessions())
      .toEqual([
        { generation: 7, starts: 1, schedules: 0, disposed: true },
        { generation: 8, starts: 1, schedules: 0, disposed: false },
      ])

    app.settings.update({ describeAssets: false })
    await expect
      .poll(() => app.assetDescription.sessions().map((session) => session.disposed))
      .toEqual([true, true])
  })

  it('opens no session in a note window: the main window owns the describer', async () => {
    const assetDescription = createTestAssetDescriptionService()
    const settings = createTestSettingsService({ describeAssets: true })
    const app = createTestAppServices({
      assetDescription,
      settings,
      window: createTestWindowService({ label: 'note-1' }),
    })
    const view = await renderInApp(tree(), { app, servicesOnly: true })
    await settings.whenLoaded()

    await expect.element(view.getByText('child')).toBeVisible()
    expect(assetDescription.sessions()).toEqual([])
  })
})
