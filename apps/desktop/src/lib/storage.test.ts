import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createTestStorageService } from '@reflect/core/testing'
import { StorageStore } from './storage.ts'

describe('StorageStore', () => {
  it('reads, writes, removes, and notifies through its area', () => {
    const storage = createTestStorageService({ local: { key: 'stored' } })
    const store = new StorageStore('key', () => storage.local)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    expect(store.get()).toBe('stored')
    store.set('written')
    store.set('written')
    expect(storage.dump().local).toEqual({ key: 'written' })
    expect(listener).toHaveBeenCalledOnce()

    unsubscribe()
    store.set(null)
    expect(storage.dump().local).toEqual({})
    expect(listener).toHaveBeenCalledOnce()
  })

  it('reads and writes schema-validated JSON', () => {
    const storage = createTestStorageService({ session: { bad: '{' } })
    const schema = z.object({ value: z.string() })
    const store = new StorageStore('key', () => storage.session)

    store.setJson(schema, { value: 'stored' })
    expect(store.getJson(schema)).toEqual({ value: 'stored' })
    expect(new StorageStore('bad', () => storage.session).getJson(schema)).toBeUndefined()
  })
})
