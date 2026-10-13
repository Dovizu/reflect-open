import { z } from 'zod'
import { errorMessage } from '../errors.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { IpcBridgeService, Unlisten } from '../ipc/ipc-service.ts'
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from './schema.ts'

/** How the initial settings load ended; `failed` means session-only updates. */
export type SettingsLoadOutcome = 'loaded' | 'failed'

export type SettingsStatus = 'loading' | SettingsLoadOutcome

type SettingsUpdater = (current: Settings) => Partial<Settings>

/**
 * The global settings document: loaded once, patches visible immediately,
 * saves persisted one at a time. When the load fails, updates stay
 * session-only so a defaults-built save never overwrites the stored document.
 */
export interface SettingsService {
  /** The current settings, merged over `DEFAULT_SETTINGS`. Stable until the next change. */
  get: () => Settings
  subscribe: (listener: () => void) => Unlisten
  /** Merges `patch` now and persists the full document in the background. */
  update: (patch: Partial<Settings>) => void
  /** Computes a patch from the latest settings; calls made before the load replay over the loaded document. */
  updateWith: (updater: SettingsUpdater) => void
  whenLoaded: () => Promise<SettingsLoadOutcome>
  /**
   * After a failed load, load the stored document again; on success it
   * replaces the session-only settings. Otherwise answers {@link whenLoaded}.
   */
  reload: () => Promise<SettingsLoadOutcome>
  /** Drains pending saves and resubmits a document that no save has confirmed. Never rejects. */
  flush: () => Promise<void>
  status: () => SettingsStatus
}

const voidSchema = z.null()

export function createSettingsService(deps: {
  ipc: IpcBridgeService
  operations: OperationsService
}): SettingsService {
  const { ipc, operations } = deps
  const listeners = new Set<() => void>()

  let state: SettingsStatus = 'loading'
  let started = false
  let current: Settings = DEFAULT_SETTINGS
  let preloadPatch: Partial<Settings> = {}
  let pendingUpdaters: SettingsUpdater[] = []

  let dirty = false
  let lastSubmission: Promise<void> = Promise.resolve()

  let resolveLoad: (outcome: SettingsLoadOutcome) => void = () => {}
  let loaded = new Promise<SettingsLoadOutcome>((resolve) => {
    resolveLoad = resolve
  })
  let reloading: Promise<SettingsLoadOutcome> | null = null

  const emit = (): void => {
    for (const listener of listeners) {
      listener()
    }
  }

  const submit = (target: Settings): void => {
    dirty = true
    lastSubmission = lastSubmission.then(async () => {
      try {
        await ipc.call('settings_save', { settings: target }, voidSchema)
        if (current === target) {
          dirty = false
        }
      } catch (error) {
        operations.start('Saving settings').fail(errorMessage(error))
      }
    })
  }

  const hydrate = (outcome: SettingsLoadOutcome, document: Settings): void => {
    let next: Settings = { ...document, ...preloadPatch }
    const queued = pendingUpdaters
    pendingUpdaters = []
    preloadPatch = {}
    for (const updater of queued) {
      next = { ...next, ...updater(next) }
    }
    state = outcome
    if (outcome === 'loaded') {
      next = replaceEqualDeep(document, next)
      current = next
      if (next !== document) {
        submit(next)
      }
    } else {
      current = next
    }
    resolveLoad(outcome)
    emit()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
    ipc.call('settings_load', {}, settingsSchema).then(
      (document) => hydrate('loaded', document),
      (error: unknown) => {
        operations.start('Loading settings').fail(errorMessage(error))
        hydrate('failed', DEFAULT_SETTINGS)
      },
    )
  }

  const reload = (): Promise<SettingsLoadOutcome> => {
    if (state !== 'failed') {
      start()
      return loaded
    }
    reloading ??= ipc
      .call('settings_load', {}, settingsSchema)
      .then(
        (document): SettingsLoadOutcome => {
          state = 'loaded'
          current = document
          loaded = Promise.resolve('loaded')
          emit()
          return 'loaded'
        },
        (error: unknown): SettingsLoadOutcome => {
          operations.start('Loading settings').fail(errorMessage(error))
          return 'failed'
        },
      )
      .finally(() => {
        reloading = null
      })
    return reloading
  }

  const apply = (updater: SettingsUpdater): void => {
    const previous = current
    const merged = { ...previous, ...updater(previous) }
    if (state === 'failed') {
      current = merged
      emit()
      return
    }
    const next = replaceEqualDeep(previous, merged)
    current = next
    if (next !== previous) {
      emit()
    }
    if (dirty || next !== previous) {
      submit(next)
    }
  }

  const drain = async (): Promise<void> => {
    let submission = lastSubmission
    await submission
    while (submission !== lastSubmission) {
      submission = lastSubmission
      await submission
    }
  }

  return {
    get() {
      start()
      return current
    },
    subscribe(listener) {
      start()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update(patch) {
      start()
      if (state === 'loading') {
        preloadPatch = { ...preloadPatch, ...patch }
        current = { ...DEFAULT_SETTINGS, ...preloadPatch }
        emit()
        return
      }
      apply(() => patch)
    },
    updateWith(updater) {
      start()
      if (state === 'loading') {
        pendingUpdaters.push(updater)
        return
      }
      apply(updater)
    },
    whenLoaded() {
      start()
      return loaded
    },
    reload,
    async flush() {
      await drain()
      if (dirty && state === 'loaded') {
        submit(current)
        await drain()
      }
    },
    status: () => state,
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Returns `next`, reusing every part of `previous` that is deeply equal to it. */
function replaceEqualDeep<T>(previous: T, next: T): T
function replaceEqualDeep(previous: unknown, next: unknown): unknown {
  if (previous === next) {
    return previous
  }
  if (Array.isArray(previous) && Array.isArray(next)) {
    const before: readonly unknown[] = previous
    const after: readonly unknown[] = next
    let equal = before.length === after.length
    const copy = after.map((item, i) => {
      const shared = replaceEqualDeep(before[i], item)
      if (shared !== before[i]) {
        equal = false
      }
      return shared
    })
    return equal ? before : copy
  }
  if (isPlainObject(previous) && isPlainObject(next)) {
    const keys = Object.keys(next)
    let equal = keys.length === Object.keys(previous).length
    const copy: Record<string, unknown> = {}
    for (const key of keys) {
      const shared = replaceEqualDeep(previous[key], next[key])
      if (shared !== previous[key] || !Object.hasOwn(previous, key)) {
        equal = false
      }
      copy[key] = shared
    }
    return equal ? previous : copy
  }
  return next
}
