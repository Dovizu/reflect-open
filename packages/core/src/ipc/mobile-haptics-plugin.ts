import { defaultLogger, type LoggerService } from '../app/logger-service.ts'
import { currentIpc } from './bridge.ts'
import type { IpcBridgeService } from './ipc-service.ts'
import { definePluginCommand, ignoredResult } from './plugin.ts'

/**
 * Typed bindings for `plugins/tauri-plugin-mobile-haptics`, the app's
 * single haptic.
 */

const impactLightCommand = definePluginCommand<Record<string, never>, unknown>(
  'mobile-haptics',
  'impact_light',
  ignoredResult,
)

/** The haptic engine. */
export interface HapticsService {
  /**
   * Fire a light impact haptic. Never rejects: where the plugin is missing
   * (desktop, browser dev), the first failure logs one warning and every
   * later call resolves without an IPC round-trip.
   */
  impactLight(): Promise<void>
}

export function createHapticsService(deps: {
  ipc: IpcBridgeService
  logger: LoggerService
}): HapticsService {
  const { ipc, logger } = deps
  let available = true
  return {
    async impactLight() {
      if (!available) {
        return
      }
      try {
        await impactLightCommand(ipc, {})
      } catch (error) {
        // Several calls can be in flight before the first rejection lands;
        // only one of them warns.
        if (!available) {
          return
        }
        available = false
        logger.warn('haptics unavailable', error)
      }
    },
  }
}

let defaultService: HapticsService | null = null

/** The process-wide `HapticsService`; one over the installed bridge unless replaced. */
export function defaultHaptics(): HapticsService {
  defaultService ??= createHapticsService({ ipc: currentIpc(), logger: defaultLogger() })
  return defaultService
}

/** Install the process-wide `HapticsService`; `null` restores a fresh bridge-backed one. */
export function setDefaultHaptics(service: HapticsService | null): void {
  defaultService = service
}
