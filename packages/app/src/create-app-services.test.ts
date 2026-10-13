import { describe, expect, it } from 'vitest'
import { createTestCoreServices } from '@reflect/core/testing'
import { createAppServices } from './create-app-services.ts'

describe('createAppServices', () => {
  it('builds the app layer over the core services', () => {
    const core = createTestCoreServices()
    const app = createAppServices(core, {})
    expect(Object.keys(app).toSorted()).toEqual(['keyboard', 'share', 'syncStatus'])
    core.database.close()
  })
})
