import { defaultClock } from '../app/clock-service.ts'
import { defaultLogger } from '../app/logger-service.ts'
import { defaultPlatform } from '../app/platform-service.ts'
import { isMobilePlatform } from '../app/platform.ts'
import { currentIpc } from '../ipc/bridge.ts'
import type { AudioRecorderService } from './audio-recorder-service.ts'
import { createNativeAudioRecorder } from './native-audio-recorder.ts'
import { createWebAudioRecorder } from './web-audio-recorder.ts'

let defaultService: AudioRecorderService | null = null

/**
 * The process-wide `AudioRecorderService`: the native recorder in the mobile
 * app, the webview recorder everywhere else, unless replaced.
 */
export function defaultAudioRecorder(): AudioRecorderService {
  if (defaultService === null) {
    const platform = defaultPlatform()
    defaultService =
      isMobilePlatform(platform.appPlatform) || platform.surface.mobileApp
        ? createNativeAudioRecorder({ ipc: currentIpc(), logger: defaultLogger() })
        : createWebAudioRecorder({ clock: defaultClock() })
  }
  return defaultService
}

/** Install the process-wide `AudioRecorderService`; `null` restores the platform default. */
export function setDefaultAudioRecorder(service: AudioRecorderService | null): void {
  defaultService = service
}
