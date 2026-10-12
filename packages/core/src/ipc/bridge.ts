import { defaultLogger } from '../app/logger-service.ts'
/**
 * The pluggable transport between `@reflect/core` and its host backend.
 *
 * `@reflect/core` is platform-agnostic: nothing in this package imports
 * `@tauri-apps/*`. A host installs a bridge at startup — the desktop app
 * adapts Tauri's `invoke`/`listen` (see `apps/desktop/src/services/tauri-ipc.ts`),
 * plain-browser dev installs the in-memory dev bridge
 * (`apps/desktop/src/dev/`), and tests install fakes via {@link setBridge}.
 * A bridge answering commands does NOT imply a native shell: gates that need
 * real plugins, custom URL schemes, or OS windows use the desktop app's
 * `isNativeShell()` instead of {@link hasBridge}.
 */

import {
  createIpcBridgeService,
  type IpcBridge,
  type IpcBridgeService,
  type Unlisten,
} from './ipc-service.ts'

export type { IpcBridge, Unlisten } from './ipc-service.ts'

let activeBridge: IpcBridge | null = null
let activeService: IpcBridgeService | null = null

/** Notified on every {@link setBridge}, so UI layers can re-read {@link hasBridge}. */
const changeListeners = new Set<() => void>()

/**
 * Install the process-wide bridge (or remove it with `null`), then notify
 * {@link subscribeBridgeChanges} subscribers. The Tauri bridge installs
 * before the first render; the browser dev bridge installs asynchronously
 * after it, which is why UI gates must subscribe rather than sample once.
 */
export function setBridge(bridge: IpcBridge | null): void {
  setDefaultIpc(
    bridge === null ? null : createIpcBridgeService(bridge, { logger: defaultLogger() }),
  )
}

/**
 * Install `service` as the process-wide {@link defaultIpc} and its transport
 * as the bridge (or remove both with `null`), then notify
 * {@link subscribeBridgeChanges} subscribers.
 */
export function setDefaultIpc(service: IpcBridgeService | null): void {
  activeBridge = service === null ? null : service.transport
  activeService = service
  for (const listener of changeListeners) {
    listener()
  }
}

/**
 * Subscribe to bridge installs/removals; returns the unsubscribe function.
 * The `useSyncExternalStore`-shaped companion to {@link hasBridge} — the
 * desktop app's `useBridgeReady()` hook builds on this pair so React gates
 * re-render when the (possibly async) install lands.
 */
export function subscribeBridgeChanges(listener: () => void): Unlisten {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

/**
 * True when a bridge is installed — i.e. IPC commands can be answered. True
 * in the real shell AND in browser dev once the in-memory dev bridge
 * installs, so this means "data is reachable", never "a native shell
 * exists" (that question is the desktop app's `isNativeShell()`). React
 * render scope must not sample this directly (the answer would go stale
 * when the dev bridge installs asynchronously) — components use
 * `useBridgeReady()`, which subscribes via {@link subscribeBridgeChanges}.
 * Imperative code (event handlers, controllers) keeps calling this at its
 * own call time.
 */
export function hasBridge(): boolean {
  return activeBridge !== null
}

/**
 * True when the installed bridge has the raw-binary transport ({@link
 * IpcBridge.invokeBinary}) — the real shell has it, the browser-dev
 * in-memory bridge does not. Callers use this to choose streamed binary
 * asset IO over the base64 JSON fallback.
 */
function hasBinaryIpc(): boolean {
  return activeBridge !== null && activeBridge.invokeBinary !== undefined
}

function noBridgeError(): Error {
  return new Error(
    'No IPC bridge is installed. Call setBridge() at startup — the desktop app installs the Tauri bridge in boot.ts; tests install a fake.',
  )
}

/** The installed bridge; throws when called before {@link setBridge}. */
export function getBridge(): IpcBridge {
  if (activeBridge === null) {
    throw noBridgeError()
  }
  return activeBridge
}

/** The {@link IpcBridgeService} over the installed bridge; throws when called before {@link setBridge}. */
export function defaultIpc(): IpcBridgeService {
  if (activeService === null) {
    throw noBridgeError()
  }
  return activeService
}

/** An {@link IpcBridgeService} that forwards each call to the bridge installed at call time. */
export function currentIpc(): IpcBridgeService {
  return {
    call: async (command, args, schema) => await defaultIpc().call(command, args, schema),
    callBinary: async (command, body, headers, schema) =>
      await defaultIpc().callBinary(command, body, headers, schema),
    listen: async (event, handler) => await defaultIpc().listen(event, handler),
    listenPlugin: async (plugin, event, handler) => {
      await defaultIpc().listenPlugin(plugin, event, handler)
    },
    subscribePlugin: (plugin, event, schema, handler) =>
      defaultIpc().subscribePlugin(plugin, event, schema, handler),
    get transport() {
      return getBridge()
    },
    get hasBinaryTransport() {
      return hasBinaryIpc()
    },
    get hasPluginEvents() {
      return activeBridge !== null && activeBridge.listenPlugin !== undefined
    },
  }
}
