import { describe, expect, it } from 'vitest'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices } from './create-app-services.ts'
import { createTestAppHost, createTestUpdaterAdapter } from './testing/index.ts'

describe('createAppServices', () => {
  it('builds the app layer over the core services', () => {
    const core = createTestCoreServices()
    const app = createAppServices(core, createTestAppHost())
    expect(Object.keys(app).toSorted()).toEqual([
      'autocompleteSuggestions',
      'calendarEvents',
      'clipboard',
      'commands',
      'deepLinkRouter',
      'exceptionTelemetry',
      'keyboard',
      'keymap',
      'lifecycle',
      'linkNavigation',
      'nativeMenu',
      'navigation',
      'opener',
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
    expect(createAppServices(core, createTestAppHost()).update.supported).toBe(false)
    const app = createAppServices(core, createTestAppHost({ updater: createTestUpdaterAdapter() }))
    expect(app.update.supported).toBe(true)
    core.database.close()
  })
})
