import { z } from 'zod'
import { currentIpc } from './bridge.ts'
import type { IpcBridgeService } from './ipc-service.ts'
import { definePluginCommand, ignoredResult } from './plugin.ts'

/**
 * Typed bindings for `plugins/tauri-plugin-app-store`, the install-channel
 * probe.
 */

const appStoreEnvironmentSchema = z.object({ environment: z.string() })

const getEnvironmentCommand = definePluginCommand<Record<string, never>, { environment: string }>(
  'app-store',
  'get_environment',
  appStoreEnvironmentSchema,
)

const syncCommand = definePluginCommand<Record<string, never>, unknown>(
  'app-store',
  'sync',
  ignoredResult,
)

const presentOfferCodeRedeemSheetCommand = definePluginCommand<Record<string, never>, unknown>(
  'app-store',
  'present_offer_code_redeem_sheet',
  ignoredResult,
)

/** The App Store install channel and its restore and redeem flows. */
export interface AppStoreService {
  /**
   * Which channel installed this build, per StoreKit 2's
   * `AppTransaction.environment`: `'Production'` (App Store), `'Sandbox'`
   * (TestFlight or a development install), or `'Xcode'` (a
   * StoreKit-configuration run). Rejects when the probe cannot answer, so an
   * unanswered probe stays distinguishable from a named channel.
   */
  environment(): Promise<string>
  /**
   * Force StoreKit to refetch transactions from the App Store
   * (`AppStore.sync()`). Apple may show a sign-in prompt, so call it only
   * from an explicit user action such as Restore Purchases.
   */
  sync(): Promise<void>
  /**
   * Show Apple's in-app offer-code redemption sheet. A redeemed code arrives
   * through the iap plugin's `purchaseUpdated` event, not through this call's
   * result, which resolves as soon as the sheet is presented.
   */
  presentOfferCodeRedeemSheet(): Promise<void>
}

export function createAppStoreService(deps: { ipc: IpcBridgeService }): AppStoreService {
  const { ipc } = deps
  return {
    async environment() {
      return (await getEnvironmentCommand(ipc, {})).environment
    },
    async sync() {
      await syncCommand(ipc, {})
    },
    async presentOfferCodeRedeemSheet() {
      await presentOfferCodeRedeemSheetCommand(ipc, {})
    },
  }
}

let defaultService: AppStoreService | null = null

/** The process-wide `AppStoreService`; one over the installed bridge unless replaced. */
export function defaultAppStore(): AppStoreService {
  defaultService ??= createAppStoreService({ ipc: currentIpc() })
  return defaultService
}

/** Install the process-wide `AppStoreService`; `null` restores the bridge-backed one. */
export function setDefaultAppStore(service: AppStoreService | null): void {
  defaultService = service
}

/** {@link AppStoreService.environment} on the process-wide service. */
export async function getAppStoreEnvironment(): Promise<string> {
  return await defaultAppStore().environment()
}

/** {@link AppStoreService.sync} on the process-wide service. */
export async function syncAppStore(): Promise<void> {
  await defaultAppStore().sync()
}

/** {@link AppStoreService.presentOfferCodeRedeemSheet} on the process-wide service. */
export async function presentOfferCodeRedeemSheet(): Promise<void> {
  await defaultAppStore().presentOfferCodeRedeemSheet()
}
