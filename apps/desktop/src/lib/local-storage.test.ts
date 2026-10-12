import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setDefaultStorage } from '@reflect/core'
import { createTestStorageService, type TestStorageService } from '@reflect/core/testing'
import { getLocalStorageStore, resetLocalStorageStores } from './local-storage.ts'

let storage: TestStorageService

beforeEach(() => {
  resetLocalStorageStores()
  storage = createTestStorageService({ local: { key: 'local' } })
  setDefaultStorage(storage)
})

afterEach(() => {
  setDefaultStorage(null)
})

describe('getLocalStorageStore', () => {
  it('shares one store per key and reads the local area', () => {
    expect(getLocalStorageStore('key').get()).toBe('local')
    expect(getLocalStorageStore('key')).toBe(getLocalStorageStore('key'))
    expect(getLocalStorageStore('key')).not.toBe(getLocalStorageStore('other'))
  })

  it('writes to the current default storage', () => {
    getLocalStorageStore('key').set('written')
    expect(storage.dump().local).toEqual({ key: 'written' })

    const next = createTestStorageService()
    setDefaultStorage(next)
    getLocalStorageStore('key').set('again')
    expect(next.dump().local).toEqual({ key: 'again' })
  })
})
