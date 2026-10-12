import { ReflectError } from '../errors.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { AppStoreService } from '../ipc/app-store-plugin.ts'
import type { IapProduct, IapService } from '../ipc/iap-plugin.ts'
import type { HapticsService } from '../ipc/mobile-haptics-plugin.ts'
import type { WebAuthOptions, WebAuthService } from '../ipc/web-auth-plugin.ts'

export interface TestHapticsService extends HapticsService {
  /** The number of `impactLight` calls since creation or the last `reset`. */
  impacts(): number
  reset(): void
}

/**
 * A {@link HapticsService} that counts impacts. With `fail`, every call is
 * still counted but rejects, like an engine that is not there.
 */
export function createTestHapticsService(options?: { fail?: boolean }): TestHapticsService {
  let count = 0
  return {
    impactLight() {
      count += 1
      if (options?.fail ?? false) {
        return Promise.reject(new ReflectError('io', 'test haptics: no haptic engine'))
      }
      return Promise.resolve()
    },
    impacts: () => count,
    reset() {
      count = 0
    },
  }
}

export interface TestIapService extends IapService {
  /** Calls every `subscribePurchaseUpdated` listener. */
  emitPurchaseUpdated(): void
  /** Every `purchase` product id, in order. */
  purchases(): readonly string[]
}

/**
 * An in-memory {@link IapService}. `getProducts` answers the known products
 * among the requested ids; `purchase` makes a product owned.
 */
export function createTestIapService(options?: {
  products?: readonly IapProduct[]
  owned?: readonly string[]
}): TestIapService {
  const products = options?.products ?? []
  const owned = new Set(options?.owned ?? [])
  const purchased: string[] = []
  const listeners = new Set<() => void>()
  return {
    getProducts: async (productIds) =>
      products
        .filter((product) => productIds.includes(product.productId))
        .map((product) => ({ ...product })),
    purchase(productId) {
      purchased.push(productId)
      owned.add(productId)
      return Promise.resolve()
    },
    isOwned: async (productId) => owned.has(productId),
    subscribePurchaseUpdated(listener): Unlisten {
      const entry = (): void => {
        listener()
      }
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
    emitPurchaseUpdated() {
      for (const listener of listeners) {
        listener()
      }
    },
    purchases: () => [...purchased],
  }
}

export type AppStoreCall = 'environment' | 'sync' | 'presentOfferCodeRedeemSheet'

export interface TestAppStoreService extends AppStoreService {
  /** Every call, in order. */
  calls(): readonly AppStoreCall[]
}

/** An in-memory {@link AppStoreService}; `environment` defaults to `'Production'`. */
export function createTestAppStoreService(options?: { environment?: string }): TestAppStoreService {
  const log: AppStoreCall[] = []
  return {
    environment() {
      log.push('environment')
      return Promise.resolve(options?.environment ?? 'Production')
    },
    sync() {
      log.push('sync')
      return Promise.resolve()
    },
    presentOfferCodeRedeemSheet() {
      log.push('presentOfferCodeRedeemSheet')
      return Promise.resolve()
    },
    calls: () => [...log],
  }
}

export interface TestWebAuthService extends WebAuthService {
  /** The options of every `start`, in order. */
  starts(): readonly WebAuthOptions[]
  setCallbackUrl(callbackUrl: string | null): void
}

/** A {@link WebAuthService} whose sessions end at `callbackUrl`; `null` is a cancel. */
export function createTestWebAuthService(callbackUrl: string | null): TestWebAuthService {
  let callback = callbackUrl
  const log: WebAuthOptions[] = []
  return {
    start(options) {
      log.push({ ...options })
      return Promise.resolve(callback)
    },
    starts: () => [...log],
    setCallbackUrl(next) {
      callback = next
    },
  }
}
