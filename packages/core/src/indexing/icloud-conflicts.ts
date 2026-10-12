import { defaultICloudNative } from '../ipc/icloud-native-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'

/** See `ICloudNativeService.subscribeConflicts`. */
export async function subscribeIcloudConflicts(
  handler: (paths: string[]) => void,
): Promise<Unlisten> {
  return defaultICloudNative().subscribeConflicts(handler)
}

/** See `ICloudNativeService.subscribeWatchFailed`. */
export async function subscribeIcloudWatchFailed(handler: () => void): Promise<Unlisten> {
  return defaultICloudNative().subscribeWatchFailed(handler)
}
