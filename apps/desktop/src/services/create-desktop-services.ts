import {
  createConsoleLogger,
  createBrowserHttpService,
  createPosixPathTransport,
  createSingleWindowHost,
  isMobilePlatform,
  reachWebStorage,
  type AppAdapters,
  type IpcBridge,
  type PlatformFacts,
} from '@reflect/core'
import { createNavigatorClipboardService } from '@/services/browser-clipboard.ts'
import { createBrowserDialogService } from '@/services/browser-dialog.ts'
import { createBrowserOpenerTransport } from '@/services/browser-opener.ts'
import { createDomLifecycleAdapter } from '@/services/dom-lifecycle.ts'
import { createTauriDialogService } from '@/services/tauri-dialog.ts'
import { createTauriHttpService } from '@/services/tauri-http.ts'
import { createTauriOpenerTransport } from '@/services/tauri-opener.ts'
import { createTauriPathTransport } from '@/services/tauri-path.ts'
import { createTauriWindowHost } from '@/services/tauri-window.ts'

/**
 * The desktop app's adapters over `ipc`: the Tauri ones inside the native
 * shell (`facts.isNativeShell`), the browser ones in plain-browser dev.
 */
export function createDesktopAdapters(facts: PlatformFacts, ipc: IpcBridge): AppAdapters {
  const logger = createConsoleLogger()
  const common = {
    ipc,
    platform: facts,
    logger,
    storage: {
      local: reachWebStorage(logger, 'localStorage'),
      session: reachWebStorage(logger, 'sessionStorage'),
    },
    clipboard: createNavigatorClipboardService(),
    lifecycle: createDomLifecycleAdapter(),
  }
  if (facts.isNativeShell) {
    return {
      ...common,
      http: createTauriHttpService(),
      dialog: createTauriDialogService(),
      opener: createTauriOpenerTransport(),
      path: createTauriPathTransport(),
      window: createTauriWindowHost({ multiWindow: !isMobilePlatform(facts.appPlatform), logger }),
    }
  }
  return {
    ...common,
    http: createBrowserHttpService(),
    dialog: createBrowserDialogService(),
    opener: createBrowserOpenerTransport(),
    path: createPosixPathTransport('/'),
    window: createSingleWindowHost(),
  }
}
