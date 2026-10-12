import { describe, expect, it } from 'vitest'
import { createTestSettingsService } from './settings.ts'

describe('createTestSettingsService', () => {
  it('loads the seeded document without saving it', async () => {
    const settings = createTestSettingsService({ dateFormat: 'dmy' })
    settings.seed({ describeAssets: true })

    await expect(settings.whenLoaded()).resolves.toBe('loaded')

    expect(settings.get()).toMatchObject({ dateFormat: 'dmy', describeAssets: true })
    expect(settings.saves()).toEqual([])
  })

  it('refuses a seed after the load read the document', async () => {
    const settings = createTestSettingsService()
    await settings.whenLoaded()

    expect(() => settings.seed({ describeAssets: true })).toThrow(/before the first read/)
  })
})
