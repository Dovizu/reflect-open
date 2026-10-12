import {
  createConsoleLogger,
  createLifecycleService,
  createOpenerService,
  createPathService,
  createPosixPathTransport,
  createWindowService,
  currentIpc,
  defaultClock,
  defaultPlatform,
  isMobilePlatform,
  setDefaultClipboard,
  setDefaultDialog,
  setDefaultLifecycle,
  setDefaultOpener,
  setDefaultPath,
  setDefaultWindow,
} from '@reflect/core'
import { createNavigatorClipboardService } from '@/services/browser-clipboard.ts'
import { createBrowserDialogService } from '@/services/browser-dialog.ts'
import { createBrowserOpenerTransport } from '@/services/browser-opener.ts'
import { createDomLifecycleAdapter } from '@/services/dom-lifecycle.ts'
import { createTauriDialogService } from '@/services/tauri-dialog.ts'
import { createTauriOpenerTransport } from '@/services/tauri-opener.ts'
import { createTauriPathTransport } from '@/services/tauri-path.ts'
import { createTauriWindowHost } from '@/services/tauri-window.ts'

/**
 * Install the process-wide shell services: the Tauri ones inside the native
 * shell, the browser ones in plain-browser dev.
 */
export function installShellServices(options: { nativeShell: boolean }): void {
  const logger = createConsoleLogger()
  const ipc = currentIpc()
  setDefaultClipboard(createNavigatorClipboardService())
  setDefaultLifecycle(
    createLifecycleService({
      ipc,
      dom: createDomLifecycleAdapter(),
      clock: defaultClock(),
      logger,
    }),
  )
  if (options.nativeShell) {
    setDefaultDialog(createTauriDialogService())
    setDefaultOpener(createOpenerService({ transport: createTauriOpenerTransport(), logger }))
    setDefaultPath(createPathService({ transport: createTauriPathTransport() }))
    setDefaultWindow(
      createWindowService({
        ipc,
        host: createTauriWindowHost({
          multiWindow: !isMobilePlatform(defaultPlatform().appPlatform),
          logger,
        }),
        logger,
      }),
    )
    return
  }
  setDefaultDialog(createBrowserDialogService())
  setDefaultOpener(createOpenerService({ transport: createBrowserOpenerTransport(), logger }))
  setDefaultPath(createPathService({ transport: createPosixPathTransport('/') }))
  setDefaultWindow(null)
}
