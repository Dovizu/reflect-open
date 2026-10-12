import { describe, expect, it } from 'vitest'
import { createTestScriptedBackupServiceFactory } from './sync.ts'

describe('createTestScriptedBackupServiceFactory', () => {
  it('hands out one scripted backup and records each creation', () => {
    const factory = createTestScriptedBackupServiceFactory({ state: { phase: 'disconnected' } })

    const backup = factory.create({ generation: 3, indexGeneration: 5 })

    expect(backup).toBe(factory.backup)
    expect(backup.getState()).toEqual({ phase: 'disconnected' })
    expect(factory.creations()).toEqual([{ generation: 3, indexGeneration: 5 }])
  })
})
