import { describe, expect, it } from 'vitest'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices } from './create-app-services.ts'
import { createTestUpdaterAdapter } from './testing/index.ts'

describe('createAppServices', () => {
  it('builds the app layer over the core services', () => {
    const core = createTestCoreServices()
    const app = createAppServices(core, {})
    expect(Object.keys(app).toSorted()).toEqual([
      'autocompleteSuggestions',
      'calendarEvents',
      'commands',
      'deepLinkRouter',
      'exceptionTelemetry',
      'keyboard',
      'keymap',
      'linkNavigation',
      'nativeMenu',
      'navigation',
      'paletteSearch',
      'share',
      'syncStatus',
      'theme',
      'update',
    ])
    core.database.close()
  })

  it('supports updates only with an updater adapter', () => {
    const core = createTestCoreServices()
    expect(createAppServices(core, {}).update.supported).toBe(false)
    const app = createAppServices(core, { updater: createTestUpdaterAdapter() })
    expect(app.update.supported).toBe(true)
    core.database.close()
  })
})
