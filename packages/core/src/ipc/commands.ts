import { z } from 'zod'
import { defaultICloudNative, type ICloudNativeService } from './icloud-native-service.ts'
import { call } from './invoke.ts'

export type {
  IcloudDownloadScope,
  IcloudScanOptions,
  IcloudStatus,
  IcloudSweepOutcome,
  IcloudSweepScope,
} from './icloud-native-service.ts'

const appVersionSchema = z.string()

/**
 * Returns the desktop application version reported by the Rust shell.
 *
 * Serves as the canonical round-trip example for the IPC boundary: a real
 * `#[tauri::command]`, a zod-validated response, no direct `invoke` in the UI.
 */
export async function getAppVersion(): Promise<string> {
  return await call('app_version', {}, appVersionSchema)
}

const mobileStorageInfoSchema = z.object({
  localRoot: z.string(),
  /** The container's `Documents/` dir when iCloud is usable — new graphs are created inside it. */
  icloudDocumentsRoot: z.string().nullable(),
  /** Every graph already in the container (name-sorted) — onboarding and the switcher list them. */
  icloudGraphRoots: z.array(z.string()),
})

/**
 * Where the mobile graph can live (Plan 21): the app-sandbox `Documents/`
 * directory (always present, never synced) and the app's iCloud Drive
 * container when iCloud is usable — plus every graph the container already
 * holds (a user can keep several).
 */
export type MobileStorageInfo = z.infer<typeof mobileStorageInfoSchema>

/** Which of the {@link MobileStorageInfo} roots the graph lives in. */
export type MobileStorageKind = 'icloud' | 'local'

/**
 * Resolves the mobile storage roots (Plan 21). Mobile-only — the desktop
 * shell rejects it (graphs are user-picked there). iOS container paths change
 * across restore/update; resolve this fresh every launch and never persist
 * the returned paths.
 */
export async function mobileStorage(): Promise<MobileStorageInfo> {
  return await call('mobile_storage', {}, mobileStorageInfoSchema)
}

/**
 * The app-sandbox `Documents/` root alone — the cheap half of
 * {@link mobileStorage}, available before the iCloud container resolves (the
 * first container lookup can take a long time on a fresh install). Mobile
 * only; derive fresh every launch and never persist.
 */
export async function mobileStorageLocal(): Promise<string> {
  return await call('mobile_storage_local', {}, z.string())
}

export const icloudStatus: ICloudNativeService['status'] = () => defaultICloudNative().status()
export const icloudAdoptGraph: ICloudNativeService['adoptGraph'] = (...args) =>
  defaultICloudNative().adoptGraph(...args)
export const icloudConflictsScan: ICloudNativeService['conflictsScan'] = (...args) =>
  defaultICloudNative().conflictsScan(...args)
export const icloudWatchStart: ICloudNativeService['watchStart'] = (...args) =>
  defaultICloudNative().watchStart(...args)
export const icloudWatchStop: ICloudNativeService['watchStop'] = () =>
  defaultICloudNative().watchStop()
export const icloudDownloadPending: ICloudNativeService['downloadPending'] = (...args) =>
  defaultICloudNative().downloadPending(...args)
export const icloudPendingCount: ICloudNativeService['pendingCount'] = (...args) =>
  defaultICloudNative().pendingCount(...args)
export const icloudRequestDownloads: ICloudNativeService['requestDownloads'] = (...args) =>
  defaultICloudNative().requestDownloads(...args)
