import { initializeExceptionTelemetry } from '@/lib/exception-telemetry.ts'
import { tauriBridge } from '@/lib/tauri-bridge.ts'
import { detectPlatformFacts } from '@/services/detect-platform.ts'
import {
  createPlatformService,
  defaultPlatform,
  setBridge,
  setDefaultPlatform,
} from '@reflect/core'
import { isTauri } from '@tauri-apps/api/core'

// Runs before every module imported after this one, so the platform facts,
// exception telemetry, and the IPC bridge exist while the rest of the app's
// modules evaluate.
setDefaultPlatform(createPlatformService(detectPlatformFacts(isTauri())))
initializeExceptionTelemetry()

// Install the Tauri bridge when running inside a Tauri webview. Plain-browser
// dev (`pnpm dev` without the shell) installs nothing here — the platform
// root later installs the in-memory dev bridge instead, and features that
// need the real shell rather than just an answering bridge gate on
// `isNativeShell()`.
if (defaultPlatform().isNativeShell) {
  setBridge(tauriBridge)
}
