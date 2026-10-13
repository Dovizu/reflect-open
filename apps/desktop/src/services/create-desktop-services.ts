import { createLifecycleService, createOperationsService, type AppHost } from '@reflect/app'
import {
  MAIN_WINDOW_LABEL,
  createBrowserHttpService,
  createNoDeepLinkSource,
  createPosixPathTransport,
  createSingleWindowHost,
  isMobilePlatform,
  reachWebStorage,
  type ClockService,
  type CoreAdapters,
  type IpcBridgeService,
  type LoggerService,
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
 * The host primitives that `boot.ts` builds once and shares between the layers.
 */
export interface DesktopPrimitives {
  readonly ipc: IpcBridgeService
  readonly clock: ClockService
  readonly logger: LoggerService
}

/**
 * The desktop app's core adapters: the Tauri ones inside the native shell
 * (`facts.isNativeShell`), the browser ones in plain-browser dev.
 */
export function createDesktopAdapters(
  facts: PlatformFacts,
  { logger, clock }: Omit<DesktopPrimitives, 'ipc'>,
): Omit<CoreAdapters, 'ipc' | 'activity' | 'progress'> {
  const common = {
    platform: facts,
    clock,
    logger,
    storage: {
      local: reachWebStorage(logger, 'localStorage'),
      session: reachWebStorage(logger, 'sessionStorage'),
    },
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
 * The desktop app's host for the app layer: the lifecycle service and the
 * operations list over the page, the Tauri updater and native menus inside
 * the native shell, and Sentry exception telemetry everywhere.
 */
export function createDesktopHost(
  facts: PlatformFacts,
  { ipc, clock, logger }: DesktopPrimitives,
): AppHost {
  const lifecycle = createLifecycleService({ ipc, dom: createDomLifecycleAdapter(), clock, logger })
  const common = {
    lifecycle,
    operations: createOperationsService({ clock }),
    clipboard: createNavigatorClipboardService(),
  }
  const exceptionTelemetry = createExceptionTelemetry({
    dsn: buildExceptionTelemetryDsn(),
    release: `reflect@${facts.appVersion}`,
    sdk: sentryExceptionTelemetrySdk,
    logger,
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
