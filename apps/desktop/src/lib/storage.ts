import { getJson, setJson, type KeyValueStore } from '@reflect/core'
import type { ZodType } from 'zod'

/**
 * One key of a {@link KeyValueStore} with bound methods, shaped for
 * `useSyncExternalStore`. The area is resolved on every call so that a
 * replaced default storage takes effect at once.
 */
export class StorageStore {
  private readonly key: string
  private readonly area: () => KeyValueStore

  constructor(key: string, area: () => KeyValueStore) {
    this.key = key
    this.area = area
  }

  subscribe = (listener: () => void): (() => void) => this.area().subscribe(this.key, listener)

  get = (): string | null => this.area().get(this.key)

  getJson = <T>(schema: ZodType<T>): T | undefined => getJson(this.area(), this.key, schema)

  set = (value: string | null): void => {
    this.area().set(this.key, value)
  }

  setJson = <T>(schema: ZodType<T>, value: T): void => {
    setJson(this.area(), this.key, schema, value)
  }
}
