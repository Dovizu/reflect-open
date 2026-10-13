import { describe, expect, it } from 'vitest'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices } from './create-app-services.ts'
import { createTestLifecycleService, createTestUpdaterAdapter } from './testing/index.ts'

describe('createAppServices', () => {
  it('builds the app layer over the core services', () => {
    const core = createTestCoreServices()
    const app = createAppServices(core, { lifecycle: createTestLifecycleService() })
    expect(Object.keys(app).toSorted()).toEqual([
      'autocompleteSuggestions',
      'calendarEvents',
      'commands',
      'deepLink',
      'exceptionTelemetry',
      'keyboard',
      'keymap',
      'lifecycle',
      'linkNavigation',
      'nativeMenu',
      'navigation',
      'paletteSearch',
      'quitPolicy',
      'share',
      'syncStatus',
      'theme',
      'update',
    ])
    core.database.close()
  })

  it('supports updates only with an updater adapter', () => {
    const core = createTestCoreServices()
    const lifecycle = createTestLifecycleService()
    expect(createAppServices(core, { lifecycle }).update.supported).toBe(false)
    const app = createAppServices(core, { lifecycle, updater: createTestUpdaterAdapter() })
    expect(app.update.supported).toBe(true)
    core.database.close()
  })
})
