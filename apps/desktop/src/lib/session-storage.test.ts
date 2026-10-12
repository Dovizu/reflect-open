import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setDefaultStorage } from '@reflect/core'
import { createTestStorageService, type TestStorageService } from '@reflect/core/testing'
import { getSessionStorageStore, resetSessionStorageStores } from './session-storage.ts'

let storage: TestStorageService

beforeEach(() => {
  resetSessionStorageStores()
  storage = createTestStorageService({ session: { key: 'session' } })
  setDefaultStorage(storage)
})

afterEach(() => {
  setDefaultStorage(null)
})

describe('getSessionStorageStore', () => {
  it('shares one store per key and reads the session area', () => {
    expect(getSessionStorageStore('key').get()).toBe('session')
    expect(getSessionStorageStore('key')).toBe(getSessionStorageStore('key'))
    expect(getSessionStorageStore('key')).not.toBe(getSessionStorageStore('other'))
  })

  it('writes to the current default storage', () => {
    getSessionStorageStore('key').set('written')
    expect(storage.dump().session).toEqual({ key: 'written' })

    const next = createTestStorageService()
    setDefaultStorage(next)
    getSessionStorageStore('key').set('again')
    expect(next.dump().session).toEqual({ key: 'again' })
  })
})
