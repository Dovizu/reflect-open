import { defaultClock, type ClockService } from '../app/clock-service.ts'
import { defaultLogger, type LoggerService } from '../app/logger-service.ts'
import { defaultPlatform, type PlatformFacts } from '../app/platform-service.ts'
import { isMobilePlatform } from '../app/platform.ts'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'
import type { AudioRecorderService } from './audio-recorder-service.ts'
import { createNativeAudioRecorder } from './native-audio-recorder.ts'
import { createWebAudioRecorder } from './web-audio-recorder.ts'

/** The native recorder in the mobile app, the webview recorder everywhere else. */
export function createPlatformAudioRecorder(deps: {
  platform: PlatformFacts
  ipc: IpcBridgeService
  clock: ClockService
  logger: LoggerService
}): AudioRecorderService {
  const { platform, ipc, clock, logger } = deps
  return isMobilePlatform(platform.appPlatform) || platform.surface.mobileApp
    ? createNativeAudioRecorder({ ipc, logger })
    : createWebAudioRecorder({ clock })
}

let defaultService: AudioRecorderService | null = null

/** The process-wide `AudioRecorderService`; the platform's recorder unless replaced. */
export function defaultAudioRecorder(): AudioRecorderService {
  defaultService ??= createPlatformAudioRecorder({
    platform: defaultPlatform(),
    ipc: currentIpc(),
    clock: defaultClock(),
    logger: defaultLogger(),
  })
  return defaultService
}

/** Install the process-wide `AudioRecorderService`; `null` restores the platform default. */
export function setDefaultAudioRecorder(service: AudioRecorderService | null): void {
  defaultService = service
}
