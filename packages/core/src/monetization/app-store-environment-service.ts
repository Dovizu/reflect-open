import { z } from 'zod'
import { defaultPlatform, type PlatformService } from '../app/platform-service.ts'
import { defaultStorage, getJson, setJson, type StorageService } from '../app/storage-service.ts'
import { defaultAppStore, type AppStoreService } from '../ipc/app-store-plugin.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'

const appStoreEnvironmentSchema = z.enum(['Production', 'Sandbox', 'Xcode']).nullable()

/** The channel that installed this build, or `null` when unknown or unrecognized. */
export type AppStoreEnvironment = z.infer<typeof appStoreEnvironmentSchema>

/**
 * The channels worth remembering across launches. A remembered `Production`
 * reads exactly like no seed at all, so storing it can only let one launch's
 * answer outlive that launch.
 */
const rememberedEnvironmentSchema = z.enum(['Sandbox', 'Xcode'])

export const APP_STORE_ENVIRONMENT_STORAGE_KEY = 'reflect.app-store.environment'

export interface AppStoreEnvironmentState {
  /** This launch's answer, else the remembered `Sandbox` or `Xcode`, else `null`. */
  readonly value: AppStoreEnvironment
  /** True while nothing is known and this launch has no settled answer yet. */
  readonly isLoading: boolean
  /** True when this launch's last probe failed. */
  readonly isError: boolean
}

/** The App Store install channel, probed once per launch. */
export interface AppStoreEnvironmentService {
  getState: () => AppStoreEnvironmentState
  subscribe: (listener: () => void) => Unlisten
  /**
   * This launch's channel, probed unless this launch already answered. A
   * failed probe keeps the remembered channel and shows in `getState().isError`.
   */
  environment: () => Promise<AppStoreEnvironment>
  /** Forgets this launch's answer, and probes again while anyone is subscribed. */
  invalidate: () => void
}

const IDLE_STATE: AppStoreEnvironmentState = { value: null, isLoading: false, isError: false }

export function createAppStoreEnvironmentService(deps: {
  appStore: AppStoreService
  storage: StorageService
  platform: PlatformService
}): AppStoreEnvironmentService {
  const { appStore, storage, platform } = deps
  const enabled = platform.appPlatform === 'ios'
  const listeners = new Set<() => void>()

  let value: AppStoreEnvironment = null
  let answered = false
  let settled = false
  let probing = false
  let failed = false
  let pendingProbe: Promise<AppStoreEnvironment> | null = null
  let state: AppStoreEnvironmentState = IDLE_STATE

  function computeState(): AppStoreEnvironmentState {
    return { value, isLoading: value === null && (probing || !settled), isError: failed }
  }

  if (enabled) {
    value =
      getJson(storage.local, APP_STORE_ENVIRONMENT_STORAGE_KEY, rememberedEnvironmentSchema) ?? null
    state = computeState()
  }

  function publish(): void {
    const next = computeState()
    if (
      next.value === state.value &&
      next.isLoading === state.isLoading &&
      next.isError === state.isError
    ) {
      return
    }
    state = next
    for (const listener of listeners) {
      listener()
    }
  }

  function remember(environment: AppStoreEnvironment): void {
    const remembered = rememberedEnvironmentSchema.safeParse(environment)
    if (remembered.success) {
      setJson(
        storage.local,
        APP_STORE_ENVIRONMENT_STORAGE_KEY,
        rememberedEnvironmentSchema,
        remembered.data,
      )
    } else {
      storage.local.set(APP_STORE_ENVIRONMENT_STORAGE_KEY, null)
    }
  }

  async function probe(): Promise<AppStoreEnvironment> {
    probing = true
    publish()
    try {
      const parsed = appStoreEnvironmentSchema.safeParse(await appStore.environment())
      value = parsed.success ? parsed.data : null
      answered = true
      failed = false
      remember(value)
    } catch {
      failed = true
    } finally {
      probing = false
      settled = true
      publish()
    }
    return value
  }

  function environment(): Promise<AppStoreEnvironment> {
    if (!enabled) {
      return Promise.resolve(null)
    }
    if (answered) {
      return Promise.resolve(value)
    }
    if (pendingProbe === null) {
      const current = probe()
      pendingProbe = current
      void current.finally(() => {
        if (pendingProbe === current) pendingProbe = null
      })
    }
    return pendingProbe
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    environment,
    invalidate() {
      answered = false
      if (listeners.size > 0) {
        void environment()
      }
    },
  }
}

let defaultService: AppStoreEnvironmentService | null = null

/** The process-wide `AppStoreEnvironmentService`; one over the default services unless replaced. */
export function defaultAppStoreEnvironment(): AppStoreEnvironmentService {
  defaultService ??= createAppStoreEnvironmentService({
    appStore: defaultAppStore(),
    storage: defaultStorage(),
    platform: defaultPlatform(),
  })
  return defaultService
}

/** Installs the process-wide `AppStoreEnvironmentService`; `null` restores the default one. */
export function setDefaultAppStoreEnvironment(service: AppStoreEnvironmentService | null): void {
  defaultService = service
}
