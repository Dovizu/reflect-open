import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import type { Settings } from '@reflect/core'
import type { TestAppServices } from '@reflect/core/testing'
import { renderInApp } from '@/test-utils/render-in-app.tsx'
import { DescribeAssetsField } from './describe-assets-field.tsx'

const PROVIDER = {
  id: 'cfg',
  provider: 'anthropic' as const,
  model: 'claude-opus-4-8',
  keyHint: 'wxyz1',
}

async function renderField(settings?: Partial<Settings>): Promise<TestAppServices> {
  const { app } = await renderInApp(<DescribeAssetsField />, {
    graph: { generation: 5 },
    settings: {
      describeAssets: true,
      aiProviders: [PROVIDER],
      defaultAiProviderId: 'cfg',
      ...settings,
    },
  })
  return app
}

describe('DescribeAssetsField', () => {
  it('reflects and toggles the automatic OCR setting', async () => {
    const app = await renderField()
    const toggle = page.getByRole('switch', { name: /ocr new assets automatically/i })
    await expect.element(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await vi.waitFor(() => expect(app.settings.get().describeAssets).toBe(false))
  })

  it('disables the backfill until an AI provider is configured', async () => {
    await renderField({ aiProviders: [], defaultAiProviderId: null })
    await expect.element(page.getByRole('button', { name: /backfill assets/i })).toBeDisabled()
    await expect.element(page.getByText(/add an ai provider to enable this/i)).toBeInTheDocument()
  })

  it('confirms the cost before running the backfill, then runs it pinned to the graph', async () => {
    const app = await renderField()
    await page.getByRole('button', { name: /backfill assets/i }).click()

    // The cost warning appears; nothing is sent until the user confirms.
    await expect.element(page.getByText(/backfill assets\?/i)).toBeInTheDocument()
    expect(app.assetDescription.backfills()).toEqual([])

    await page.getByRole('button', { name: /^backfill assets$/i }).click()
    expect(app.assetDescription.backfills()).toEqual([5])
  })

  it('cancels without sending anything', async () => {
    const app = await renderField()
    await page.getByRole('button', { name: /backfill assets/i }).click()
    await page.getByRole('button', { name: /cancel/i }).click()
    expect(app.assetDescription.backfills()).toEqual([])
  })
})
