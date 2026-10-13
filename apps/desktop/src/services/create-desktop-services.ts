import type { AppHost } from '@reflect/app'
import {
  MAIN_WINDOW_LABEL,
  createConsoleLogger,
  createBrowserHttpService,
  createNoDeepLinkSource,
  createPosixPathTransport,
  createSingleWindowHost,
  isMobilePlatform,
  reachWebStorage,
  type CoreAdapters,
  type IpcBridge,
  type PlatformFacts,
} from '@reflect/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import {
  buildExceptionTelemetryDsn,
  createExceptionTelemetry,
  sentryExceptionTelemetrySdk,
} from '@/lib/exception-telemetry.ts'
import { createNavigatorClipboardService } from '@/services/browser-clipboard.ts'
import { createBrowserDialogService } from '@/services/browser-dialog.ts'
import { createBrowserOpenerTransport } from '@/services/browser-opener.ts'
import { createBrowserImageCodec } from '@/services/browser-image-codec.ts'
import { createDomLifecycleAdapter } from '@/services/dom-lifecycle.ts'
import { createTauriDeepLinkSource } from '@/services/tauri-deep-link.ts'
import { createTauriDialogService } from '@/services/tauri-dialog.ts'
import { createTauriNativeMenuHost } from '@/services/native-menu.ts'
import { createTauriHttpService } from '@/services/tauri-http.ts'
import { createTauriOpenerTransport } from '@/services/tauri-opener.ts'
import { createTauriPathTransport } from '@/services/tauri-path.ts'
import { createTauriUpdaterAdapter } from '@/services/tauri-updater.ts'
import { createTauriWindowHost } from '@/services/tauri-window.ts'

/**
 * The desktop app's adapters over `ipc`: the Tauri ones inside the native
 * shell (`facts.isNativeShell`), the browser ones in plain-browser dev.
 */
export function createDesktopAdapters(facts: PlatformFacts, ipc: IpcBridge): CoreAdapters {
  const logger = createConsoleLogger()
  const common = {
    ipc,
    platform: facts,
    logger,
    storage: {
      local: reachWebStorage(logger, 'localStorage'),
      session: reachWebStorage(logger, 'sessionStorage'),
    },
    lifecycle: createDomLifecycleAdapter(),
    imageCodec: createBrowserImageCodec(),
  }
  if (facts.isNativeShell) {
    const window = createTauriWindowHost({
      multiWindow: !isMobilePlatform(facts.appPlatform),
      logger,
    })
    return {
      ...common,
      http: createTauriHttpService(),
      dialog: createTauriDialogService(),
      path: createTauriPathTransport(),
      window,
      convertFileSrc,
      // The OS delivers deep links to every webview; only the main window takes them.
      deepLink:
        window.label === MAIN_WINDOW_LABEL ? createTauriDeepLinkSource() : createNoDeepLinkSource(),
    }
  }
  return {
    ...common,
    http: createBrowserHttpService(),
    dialog: createBrowserDialogService(),
    path: createPosixPathTransport('/'),
    window: createSingleWindowHost(),
  }
}

/**
 * The desktop app's host for the app layer: the Tauri updater and native
 * menus inside the native shell, and Sentry exception telemetry everywhere.
 */
export function createDesktopHost(facts: PlatformFacts, ipc: IpcBridge): AppHost {
  void ipc
  const common = { clipboard: createNavigatorClipboardService() }
  const exceptionTelemetry = createExceptionTelemetry({
    dsn: buildExceptionTelemetryDsn(),
    release: `reflect@${facts.appVersion}`,
    sdk: sentryExceptionTelemetrySdk,
    logger: createConsoleLogger(),
  })
  if (facts.isNativeShell) {
    return {
      ...common,
      opener: createTauriOpenerTransport(),
      exceptionTelemetry,
      updater: createTauriUpdaterAdapter(),
      nativeMenu: createTauriNativeMenuHost(),
    }
  }
  return { ...common, opener: createBrowserOpenerTransport(), exceptionTelemetry }
}
