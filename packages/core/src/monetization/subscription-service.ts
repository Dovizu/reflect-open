import { z } from 'zod'
import type { ClockService } from '../app/clock-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { PlatformService } from '../app/platform-service.ts'
import { getJson, setJson, type StorageService } from '../app/storage-service.ts'
import { IAP_PRODUCT_IDS, type IapService } from '../ipc/iap-plugin.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'

const activeSubscriptionSchema = z.enum(['yearly', 'monthly']).nullable()

/** The App Store subscription this device owns, or `null` for none. */
export type ActiveSubscription = z.infer<typeof activeSubscriptionSchema>

type SubscriptionPlan = Exclude<ActiveSubscription, null>

const activeSubscriptionSeedSchema = z.object({
  value: activeSubscriptionSchema,
  updatedAt: z.number(),
})

export const ACTIVE_SUBSCRIPTION_STORAGE_KEY = 'reflect.iap.active-subscription'
const ACTIVE_SUBSCRIPTION_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000
const ENTITLEMENT_LOOKUP_TIMEOUT_MS = 15_000
/** How long a live answer counts as fresh for `activeSubscription`. */
const FRESH_MS = 60_000
/** A failed lookup is retried once after this delay. */
const RETRY_DELAY_MS = 1000

export interface SubscriptionState {
  /** The live answer, else a seed from the last two days, else `null`. */
  readonly value: ActiveSubscription
  /** True while no plan is known and this launch has no settled answer yet. */
  readonly isLoading: boolean
  /** True when the last lookup failed and no plan is known. */
  readonly isError: boolean
}

/** The current App Store subscription, seeded from the last launch. */
export interface SubscriptionService {
  getState: () => SubscriptionState
  subscribe: (listener: () => void) => Unlisten
  /**
   * The subscription, looked up in StoreKit unless a live answer is less than
   * a minute old. A failed lookup resolves the current value and shows in
   * `getState().isError`.
   */
  activeSubscription: () => Promise<ActiveSubscription>
  /** Looks the subscription up in StoreKit now and resolves the current value. */
  refetch: () => Promise<ActiveSubscription>
  /** Marks the answer stale, and looks it up again while anyone is subscribed. */
  invalidate: () => void
}

const IDLE_STATE: SubscriptionState = { value: null, isLoading: false, isError: false }

/**
 * Resolves the first plan that a lookup confirms, else `null` once every
 * lookup settles, else the first error.
 */
function resolveActiveSubscription(
  lookups: readonly Promise<SubscriptionPlan | null>[],
): Promise<ActiveSubscription> {
  return new Promise((resolve, reject) => {
    let pending = lookups.length
    const errors: unknown[] = []

    function settleEmptyLookup(): void {
      pending -= 1
      if (pending !== 0) {
        return
      }
      if (errors.length > 0) {
        reject(errors[0])
      } else {
        resolve(null)
      }
    }

    for (const lookup of lookups) {
      void lookup.then(
        (plan) => {
          if (plan !== null) {
            resolve(plan)
            return
          }
          settleEmptyLookup()
        },
        (error: unknown) => {
          errors.push(error)
          settleEmptyLookup()
        },
      )
    }
  })
}

export function createSubscriptionService(deps: {
  iap: IapService
  storage: StorageService
  clock: ClockService
  platform: PlatformService
  logger: LoggerService
}): SubscriptionService {
  const { iap, storage, clock, platform, logger } = deps
  const enabled = platform.appPlatform === 'ios'
  const listeners = new Set<() => void>()
  const pendingEntitlementLookups = new Map<string, Promise<boolean>>()

  let value: ActiveSubscription = null
  /** Epoch ms of the last live answer, or `null` before one or after `invalidate`. */
  let answeredAt: number | null = null
  let hasLiveAnswer = false
  let settled = false
  let fetching = false
  let failed = false
  let pendingRun: Promise<ActiveSubscription> | null = null
  let state: SubscriptionState = IDLE_STATE

  if (enabled) {
    const seed = getJson(
      storage.local,
      ACTIVE_SUBSCRIPTION_STORAGE_KEY,
      activeSubscriptionSeedSchema,
    )
    if (seed !== undefined && clock.now() - seed.updatedAt <= ACTIVE_SUBSCRIPTION_MAX_AGE_MS) {
      value = seed.value
    }
    state = computeState()
  }

  function computeState(): SubscriptionState {
    return {
      value,
      isLoading: value === null && !hasLiveAnswer && (fetching || !settled),
      isError: failed && value === null,
    }
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

  function withEntitlementTimeout(operation: Promise<boolean>): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = clock.setTimeout(() => {
        reject(new Error('StoreKit entitlement lookup timed out'))
      }, ENTITLEMENT_LOOKUP_TIMEOUT_MS)

      void operation.then(
        (owned) => {
          clock.clearTimeout(timeout)
          resolve(owned)
        },
        (error: unknown) => {
          clock.clearTimeout(timeout)
          reject(error)
        },
      )
    })
  }

  function lookupEntitlement(productId: string): Promise<boolean> {
    const pending = pendingEntitlementLookups.get(productId)
    if (pending !== undefined) {
      return pending
    }

    const lookup = iap.isOwned(productId)
    pendingEntitlementLookups.set(productId, lookup)
    function clearPendingLookup(): void {
      if (pendingEntitlementLookups.get(productId) === lookup) {
        pendingEntitlementLookups.delete(productId)
      }
    }
    void lookup.then(clearPendingLookup, clearPendingLookup)
    return lookup
  }

  async function lookupOnce(): Promise<ActiveSubscription> {
    return await resolveActiveSubscription([
      withEntitlementTimeout(lookupEntitlement(IAP_PRODUCT_IDS.yearly)).then((owned) =>
        owned ? 'yearly' : null,
      ),
      withEntitlementTimeout(lookupEntitlement(IAP_PRODUCT_IDS.monthly)).then((owned) =>
        owned ? 'monthly' : null,
      ),
    ])
  }

  async function lookupWithRetry(): Promise<ActiveSubscription> {
    try {
      return await lookupOnce()
    } catch {
      await clock.sleep(RETRY_DELAY_MS)
      return await lookupOnce()
    }
  }

  async function run(): Promise<ActiveSubscription> {
    fetching = true
    publish()
    try {
      const next = await lookupWithRetry()
      value = next
      hasLiveAnswer = true
      answeredAt = clock.now()
      failed = false
      setJson(storage.local, ACTIVE_SUBSCRIPTION_STORAGE_KEY, activeSubscriptionSeedSchema, {
        value: next,
        updatedAt: clock.now(),
      })
    } catch (error) {
      failed = true
      logger.warn('Looking up the App Store subscription failed', error)
    } finally {
      fetching = false
      settled = true
      publish()
    }
    return value
  }

  function refetch(): Promise<ActiveSubscription> {
    if (!enabled) {
      return Promise.resolve(null)
    }
    if (pendingRun === null) {
      const current = run()
      pendingRun = current
      void current.finally(() => {
        if (pendingRun === current) pendingRun = null
      })
    }
    return pendingRun
  }

  function invalidate(): void {
    answeredAt = null
    if (listeners.size > 0) {
      void refetch()
    }
  }

  if (enabled) {
    iap.subscribePurchaseUpdated(invalidate)
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    activeSubscription() {
      if (answeredAt !== null && clock.now() - answeredAt < FRESH_MS) {
        return Promise.resolve(value)
      }
      return refetch()
    },
    refetch,
    invalidate,
  }
}
