import { describe, expect, it } from 'vitest'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices } from './create-app-services.ts'
import { createTestOperationsService, createTestUpdaterAdapter } from './testing/index.ts'

describe('createAppServices', () => {
  it('builds the app layer over the core services', () => {
    const core = createTestCoreServices()
    const app = createAppServices(core, { operations: createTestOperationsService() })
    expect(Object.keys(app).toSorted()).toEqual([
      'autocompleteSuggestions',
      'calendarEvents',
      'commands',
      'deepLink',
      'exceptionTelemetry',
      'keyboard',
      'keymap',
      'linkNavigation',
      'nativeMenu',
      'navigation',
      'operations',
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
    const operations = createTestOperationsService()
    expect(createAppServices(core, { operations }).update.supported).toBe(false)
    const app = createAppServices(core, { operations, updater: createTestUpdaterAdapter() })
    expect(app.update.supported).toBe(true)
    core.database.close()
  })
})
