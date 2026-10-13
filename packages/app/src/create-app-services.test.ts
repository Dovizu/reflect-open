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
      'dialog',
      'exceptionTelemetry',
      'graphBoot',
      'keyboard',
      'keymap',
      'lifecycle',
      'linkNavigation',
      'mobileOnboarding',
      'nativeMenu',
      'navigation',
      'opener',
      'operations',
      'paletteSearch',
      'platform',
      'quitPolicy',
      'share',
      'syncStatus',
      'theme',
      'update',
      'window',
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
