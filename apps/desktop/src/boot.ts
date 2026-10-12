import {
  buildExceptionTelemetryDsn,
  createExceptionTelemetry,
  sentryExceptionTelemetrySdk,
} from '@/lib/exception-telemetry.ts'
import { createBrowserImageCodec } from '@/services/browser-image-codec.ts'
import { detectPlatformFacts } from '@/services/detect-platform.ts'
import { createTauriHttpService } from '@/services/tauri-http.ts'
import { installShellServices } from '@/services/shell-services.ts'
import { createTauriIpcTransport } from '@/services/tauri-ipc.ts'
import {
  createBrowserHttpService,
  createPlatformService,
  defaultLogger,
  defaultPlatform,
  setBridge,
  setDefaultExceptionTelemetry,
  setDefaultHttp,
  setDefaultImageCodec,
  setDefaultPlatform,
} from '@reflect/core'
import { isTauri } from '@tauri-apps/api/core'

// Runs before every module imported after this one, so the platform facts,
// exception telemetry, and the IPC bridge exist while the rest of the app's
// modules evaluate.
setDefaultPlatform(createPlatformService(detectPlatformFacts(isTauri())))
const exceptionTelemetry = createExceptionTelemetry({
  dsn: buildExceptionTelemetryDsn(),
  release: `reflect@${__REFLECT_VERSION__}`,
  sdk: sentryExceptionTelemetrySdk,
  logger: defaultLogger(),
})
setDefaultExceptionTelemetry(exceptionTelemetry)
exceptionTelemetry.install()

// Install the Tauri bridge when running inside a Tauri webview. Plain-browser
// dev (`pnpm dev` without the shell) installs nothing here — the platform
// root later installs the in-memory dev bridge instead, and features that
// need the real shell rather than just an answering bridge gate on
// `isNativeShell()`.
if (defaultPlatform().isNativeShell) {
  setBridge(createTauriIpcTransport())
}

setDefaultHttp(
  defaultPlatform().isNativeShell ? createTauriHttpService() : createBrowserHttpService(),
)

// The dialog, clipboard, opener, path, window, and lifecycle services.
installShellServices({ nativeShell: defaultPlatform().isNativeShell })

setDefaultImageCodec(createBrowserImageCodec())
