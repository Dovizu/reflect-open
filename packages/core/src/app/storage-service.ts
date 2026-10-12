import type { ZodType } from 'zod'
import { defaultLogger, type LoggerService } from './logger-service.ts'

/** One string-valued key-value area whose keys can be observed. */
export interface KeyValueStore {
  /** The stored value, or `null` when nothing is stored or storage could not be read. */
  get(key: string): string | null
  /** Stores `value`; `null` removes the key. */
  set(key: string, value: string | null): void
  /** Calls `listener` after every change to `key` made through this store. */
  subscribe(key: string, listener: () => void): () => void
}

/** Key-value storage that outlives a page (`local`) or a session (`session`). */
export interface StorageService {
  readonly local: KeyValueStore
  readonly session: KeyValueStore
}

/**
 * A store over a Web `Storage`. Reads are cached in memory, and listeners
 * only hear writes made through this store. A failing `Storage` degrades to
 * the in-memory cache and logs one warning.
 */
function createWebKeyValueStore(
  logger: LoggerService,
  name: string,
  storage: Storage | null,
): KeyValueStore {
  const cache = new Map<string, string | null>()
  const listeners = new Map<string, Set<() => void>>()
  let warned = false

  const warn = (action: string, key: string, error: unknown): void => {
    if (warned) {
      return
    }
    warned = true
    logger.warn(`${action} ${name} storage failed for ${key}`, error)
  }

  const get = (key: string): string | null => {
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }
    let value: string | null = null
    try {
      value = storage?.getItem(key) ?? null
    } catch (error) {
      warn('reading', key, error)
    }
    cache.set(key, value)
    return value
  }

  return {
    get,
    set(key, value) {
      // Writes go through even when unchanged, since other windows share the area.
      const changed = get(key) !== value
      cache.set(key, value)
      try {
        if (value === null) {
          storage?.removeItem(key)
        } else {
          storage?.setItem(key, value)
        }
      } catch (error) {
        warn('writing', key, error)
      }
      if (!changed) {
        return
      }
      for (const listener of listeners.get(key) ?? []) {
        listener()
      }
    },
    subscribe(key, listener) {
      const keyListeners = listeners.get(key) ?? new Set<() => void>()
      listeners.set(key, keyListeners)
      keyListeners.add(listener)
      return () => {
        keyListeners.delete(listener)
      }
    },
  }
}

/** Storage backed by Web `localStorage` and `sessionStorage`; `null` keeps an area in memory. */
export function createWebStorageService(deps: {
  logger: LoggerService
  localStorage: Storage | null
  sessionStorage: Storage | null
}): StorageService {
  return {
    local: createWebKeyValueStore(deps.logger, 'local', deps.localStorage),
    session: createWebKeyValueStore(deps.logger, 'session', deps.sessionStorage),
  }
}

/** Parses the JSON stored at `key`; `undefined` when it is missing, malformed, or fails `schema`. */
export function getJson<T>(store: KeyValueStore, key: string, schema: ZodType<T>): T | undefined {
  try {
    const value: unknown = JSON.parse(store.get(key) ?? '')
    const result = schema.safeParse(value)
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

/** Stores `value` as JSON at `key`; does nothing when it fails `schema`. */
export function setJson<T>(store: KeyValueStore, key: string, schema: ZodType<T>, value: T): void {
  const result = schema.safeParse(value)
  if (result.success) {
    store.set(key, JSON.stringify(result.data))
  }
}

/** The `window` Web storage area `name`, or `null` when there is no `window` or reaching it fails. */
export function reachWebStorage(
  logger: LoggerService,
  name: 'localStorage' | 'sessionStorage',
): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window[name]
  } catch (error) {
    logger.warn(`reaching ${name} failed`, error)
    return null
  }
}

let defaultStorageInstance: StorageService | null = null

/** The process-wide storage; the Web storage of `window` unless {@link setDefaultStorage} installed another. */
export function defaultStorage(): StorageService {
  if (defaultStorageInstance === null) {
    const logger = defaultLogger()
    defaultStorageInstance = createWebStorageService({
      logger,
      localStorage: reachWebStorage(logger, 'localStorage'),
      sessionStorage: reachWebStorage(logger, 'sessionStorage'),
    })
  }
  return defaultStorageInstance
}

/** Installs the process-wide storage; `null` restores a lazily created Web storage with an empty cache. */
export function setDefaultStorage(storage: StorageService | null): void {
  defaultStorageInstance = storage
}
