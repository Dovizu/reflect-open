import { defaultAppInfo } from '../app/app-info-service.ts'
import { defaultICloudNative, type ICloudNativeService } from './icloud-native-service.ts'
import { defaultMobileStorage, type MobileStorageInfo } from './mobile-storage-service.ts'

export type {
  IcloudDownloadScope,
  IcloudScanOptions,
  IcloudStatus,
  IcloudSweepOutcome,
  IcloudSweepScope,
} from './icloud-native-service.ts'

/** Returns the application version reported by the native shell. */
export async function getAppVersion(): Promise<string> {
  return await defaultAppInfo().version()
}

export type { MobileStorageInfo, MobileStorageKind } from './mobile-storage-service.ts'

/**
 * Resolves the mobile storage roots (Plan 21); see
 * `MobileStorageService.resolve`.
 */
export async function mobileStorage(): Promise<MobileStorageInfo> {
  return await defaultMobileStorage().resolve()
}

/** The app-sandbox `Documents/` root alone; see `MobileStorageService.resolveLocal`. */
export async function mobileStorageLocal(): Promise<string> {
  return await defaultMobileStorage().resolveLocal()
}

export const icloudStatus: ICloudNativeService['status'] = () => defaultICloudNative().status()
export const icloudPendingCount: ICloudNativeService['pendingCount'] = (...args) =>
  defaultICloudNative().pendingCount(...args)
export const icloudRequestDownloads: ICloudNativeService['requestDownloads'] = (...args) =>
  defaultICloudNative().requestDownloads(...args)
