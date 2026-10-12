import type { IpcBridge } from '@reflect/core'

/** An IPC transport whose calls wait for {@link DeferredIpcTransport.connect}. */
export interface DeferredIpcTransport {
  readonly transport: IpcBridge
  /** Supply the real transport. Throws on a second call. */
  connect(bridge: IpcBridge): void
}

/**
 * A transport for a host whose real transport is created asynchronously
 * after the services are composed. It has plugin events but no binary path.
 */
export function createDeferredIpcTransport(): DeferredIpcTransport {
  let resolveBridge: ((bridge: IpcBridge) => void) | null = null
  const ready = new Promise<IpcBridge>((resolve) => {
    resolveBridge = resolve
  })
  let connected = false
  return {
    transport: {
      invoke: async (command, args) => await (await ready).invoke(command, args),
      listen: async (event, handler) => await (await ready).listen(event, handler),
      listenPlugin: async (plugin, event, handler) => {
        const bridge = await ready
        if (bridge.listenPlugin === undefined) {
          throw new Error(
            `the connected IPC transport has no plugin events for "${plugin}:${event}"`,
          )
        }
        await bridge.listenPlugin(plugin, event, handler)
      },
    },
    connect(bridge) {
      if (connected) {
        throw new Error('the deferred IPC transport is already connected')
      }
      connected = true
      resolveBridge?.(bridge)
    },
  }
}
