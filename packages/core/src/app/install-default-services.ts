import { setDefaultIpc } from '../ipc/bridge.ts'
import { setDefaultClipboard } from './clipboard-service.ts'
import { setDefaultClock } from './clock-service.ts'
import type { AppServices } from './create-app-services.ts'
import { setDefaultDialog } from './dialog-service.ts'
import { setDefaultHashService } from './hash-service.ts'
import { setDefaultHttp } from './http-service.ts'
import { setDefaultIdService } from './id-service.ts'
import { setDefaultLifecycle } from './lifecycle-service.ts'
import { setDefaultLogger } from './logger-service.ts'
import { setDefaultOpener } from './opener-service.ts'
import { setDefaultPath } from './path-service.ts'
import { setDefaultPlatform } from './platform-service.ts'
import { setDefaultStorage } from './storage-service.ts'
import { setDefaultWindow } from './window-service.ts'

/** Point every process-wide `defaultXxx()` at the matching service of `services`. */
export function installDefaultServices(services: AppServices): void {
  setDefaultLogger(services.logger)
  setDefaultClock(services.clock)
  setDefaultIdService(services.id)
  setDefaultHashService(services.hash)
  setDefaultPlatform(services.platform)
  setDefaultStorage(services.storage)
  setDefaultHttp(services.http)
  setDefaultDialog(services.dialog)
  setDefaultClipboard(services.clipboard)
  setDefaultOpener(services.opener)
  setDefaultPath(services.path)
  setDefaultWindow(services.window)
  setDefaultLifecycle(services.lifecycle)
  setDefaultIpc(services.ipc)
}

/** Reset every process-wide `defaultXxx()` to its state before any install. */
export function resetDefaultServices(): void {
  setDefaultLogger(null)
  setDefaultClock(null)
  setDefaultIdService(null)
  setDefaultHashService(null)
  setDefaultPlatform(null)
  setDefaultStorage(null)
  setDefaultHttp(null)
  setDefaultDialog(null)
  setDefaultClipboard(null)
  setDefaultOpener(null)
  setDefaultPath(null)
  setDefaultWindow(null)
  setDefaultLifecycle(null)
  setDefaultIpc(null)
}
