import { installQueryInvalidation } from '@/lib/query-invalidation.ts'
import { createDesktopAdapters, createDesktopHost } from '@/services/create-desktop-services.ts'
import { createDeferredIpcTransport } from '@/services/deferred-ipc.ts'
import { detectPlatformFacts } from '@/services/detect-platform.ts'
import { createTauriIpcTransport } from '@/services/tauri-ipc.ts'
import { createAppServices } from '@reflect/app'
import { createCoreServices } from '@reflect/core'
import { isTauri } from '@tauri-apps/api/core'

const facts = detectPlatformFacts(isTauri())

/**
 * Plain-browser dev (`pnpm dev` without the shell) has no transport yet: the
 * platform root connects the in-memory dev transport here once it is ready.
 * `null` inside a Tauri webview. Features that need the real shell rather
 * than an answering transport gate on `isNativeShell()`.
 */
export const pendingDevIpc = facts.isNativeShell ? null : createDeferredIpcTransport()

const ipc = pendingDevIpc?.transport ?? createTauriIpcTransport()

/**
 * The app-scoped services of this webview.
 */
export const coreServices = createCoreServices(createDesktopAdapters(facts, ipc))

// Runs before every module imported after this one, so exception telemetry
// exists while the rest of the app's modules evaluate.
coreServices.exceptionTelemetry.install()
export const appServices = createAppServices(coreServices, createDesktopHost(facts, ipc))
installQueryInvalidation(coreServices)
void coreServices.contacts.refresh()
