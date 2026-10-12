import { defaultPlatform, type PlatformService } from '../app/platform-service.ts'
import { defaultStorage, type StorageService } from '../app/storage-service.ts'
import {
  defaultClassicAccess,
  type ClassicAccessService,
} from '../classic/classic-access-service.ts'
import { defaultAppStore, type AppStoreService } from '../ipc/app-store-plugin.ts'
import { IAP_PRODUCT_IDS, defaultIap, type IapProduct, type IapService } from '../ipc/iap-plugin.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import {
  defaultAppStoreEnvironment,
  type AppStoreEnvironment,
  type AppStoreEnvironmentService,
} from './app-store-environment-service.ts'
import {
  defaultSubscription,
  type ActiveSubscription,
  type SubscriptionService,
} from './subscription-service.ts'

/** Paywall visibility: `show` replaces the app; `hide` leaves the app visible. */
export type PaywallGate = 'show' | 'hide'

/** Session-wide, so the request survives leaving and re-entering Settings. */
export const PAYWALL_REQUESTED_STORAGE_KEY = 'reflect.paywall-requested'

/** Whether the paywall replaces the app, and the actions that lift it. */
export interface PaywallService {
  /**
   * Whether to render the paywall. An unsettled subscription check returns
   * `hide` so verification never blocks app startup.
   */
  gate: () => PaywallGate
  /** Calls `listener` whenever `gate()` or `requested()` may have changed. */
  subscribe: (listener: () => void) => Unlisten
  /** Whether the user asked to see the paywall in this session. */
  requested: () => boolean
  setRequested: (next: boolean) => void
  /** The store's offers for the yearly and monthly plans. */
  products: () => Promise<IapProduct[]>
  /** Runs the purchase sheet for `productId`, then looks the subscription up again. */
  purchase: (productId: string) => Promise<void>
  /** Syncs with the App Store, then resolves the subscription StoreKit now reports. */
  restore: () => Promise<ActiveSubscription>
  /** Presents the offer-code sheet, then looks the subscription up again. */
  redeemCode: () => Promise<void>
}

/**
 * Whether the paywall may block this install. Only a definite `Sandbox`
 * (TestFlight or a development install) or `Xcode` (a StoreKit-configuration
 * run) lifts the gate: an unfinished probe, a failed probe, and an
 * unrecognized value all count as an App Store install. The paywall's job is
 * to be shown, so a broken probe must never hand the customer base a free app.
 */
function isAppStoreInstall(environment: AppStoreEnvironment): boolean {
  return environment !== 'Sandbox' && environment !== 'Xcode'
}

export function createPaywallService(deps: {
  subscription: SubscriptionService
  classicAccess: ClassicAccessService
  appStoreEnvironment: AppStoreEnvironmentService
  iap: IapService
  appStore: AppStoreService
  platform: PlatformService
  storage: StorageService
}): PaywallService {
  const { subscription, classicAccess, appStoreEnvironment, iap, appStore, platform, storage } =
    deps

  const requested = (): boolean => storage.session.get(PAYWALL_REQUESTED_STORAGE_KEY) === 'true'

  return {
    gate() {
      if (platform.appPlatform !== 'ios') {
        return 'hide'
      }
      const active = subscription.getState()
      const classic = classicAccess.getState()
      if (active.value !== null || classic.active) {
        return 'hide'
      }
      // Ahead of the pending checks on purpose: a build that already knows it is
      // not from the App Store drops into the notes without waiting on StoreKit.
      if (!isAppStoreInstall(appStoreEnvironment.getState().value) && !requested()) {
        return 'hide'
      }
      return active.isLoading || classic.isLoading ? 'hide' : 'show'
    },
    subscribe(listener) {
      const unlisten = [
        subscription.subscribe(listener),
        classicAccess.subscribe(listener),
        appStoreEnvironment.subscribe(listener),
        storage.session.subscribe(PAYWALL_REQUESTED_STORAGE_KEY, listener),
      ]
      return () => {
        for (const stop of unlisten) {
          stop()
        }
      }
    },
    requested,
    setRequested(next) {
      storage.session.set(PAYWALL_REQUESTED_STORAGE_KEY, next ? 'true' : 'false')
    },
    products: () => iap.getProducts([IAP_PRODUCT_IDS.yearly, IAP_PRODUCT_IDS.monthly]),
    async purchase(productId) {
      await iap.purchase(productId)
      subscription.invalidate()
    },
    async restore() {
      await appStore.sync()
      return await subscription.refetch()
    },
    async redeemCode() {
      await appStore.presentOfferCodeRedeemSheet()
      // A redeemed code normally arrives as a purchaseUpdated event; the
      // refetch here covers a sheet that closed without emitting one.
      subscription.invalidate()
    },
  }
}

let defaultService: PaywallService | null = null

/** The process-wide `PaywallService`; one over the default services unless replaced. */
export function defaultPaywall(): PaywallService {
  defaultService ??= createPaywallService({
    subscription: defaultSubscription(),
    classicAccess: defaultClassicAccess(),
    appStoreEnvironment: defaultAppStoreEnvironment(),
    iap: defaultIap(),
    appStore: defaultAppStore(),
    platform: defaultPlatform(),
    storage: defaultStorage(),
  })
  return defaultService
}

/** Installs the process-wide `PaywallService`; `null` restores the default one. */
export function setDefaultPaywall(service: PaywallService | null): void {
  defaultService = service
}
