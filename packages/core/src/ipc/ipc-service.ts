import type { ZodType } from 'zod'
import { toAppError, type AppError } from '../errors.ts'

/** Tears down a subscription created by {@link IpcBridge.listen}. */
export type Unlisten = () => void

/**
 * The raw transport a host implements: the desktop app adapts Tauri's
 * `invoke`/`listen`, plain-browser dev installs an in-memory bridge, and
 * tests use a fake. {@link createIpcBridgeService} wraps it with validation
 * and error coercion.
 */
export interface IpcBridge {
  /** Invoke a native command, resolving with its raw (untyped) response. */
  invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>
  /** Subscribe to a native event stream, resolving with an unlisten function. */
  listen: (event: string, handler: (payload: unknown) => void) => Promise<Unlisten>
  /**
   * Invoke a native command with a **raw binary body** instead of JSON args —
   * asset bytes cross the IPC without base64 inflation. Since a raw body
   * carries no args, per-call metadata travels in `headers`. Optional: hosts
   * without a binary transport simply don't stream assets; `callBinary`
   * throws loudly rather than degrading.
   */
  invokeBinary?: (
    command: string,
    body: Uint8Array,
    headers: Record<string, string>,
  ) => Promise<unknown>
  /**
   * Attach a handler to a plugin's event stream, Tauri's
   * `addPluginListener` channel (`recordingLevel`, ...), which is distinct
   * from the global event bus behind {@link listen}.
   */
  listenPlugin?: (
    plugin: string,
    event: string,
    handler: (payload: unknown) => void,
  ) => Promise<void>
}

/**
 * A live plugin-event subscription. Registration is asynchronous (an IPC
 * round-trip) and shared per event, so the two concerns are split: `ready`
 * reports the (possibly shared) registration outcome; `unlisten` is a
 * purely local, synchronous detach from the fan-out. There is no native
 * unregistration that could fail: the underlying listener is kept for the
 * service's lifetime. Callers should observe `ready`
 * (`void sub.ready.catch(...)`) to log a host without the event stream.
 */
export interface PluginSubscription {
  ready: Promise<void>
  unlisten: Unlisten
}

/**
 * The typed IPC boundary: the single place where an untyped native response
 * becomes a validated domain value. Every failure is an {@link AppError}: a
 * rejected command is coerced via {@link toAppError}; a response that doesn't
 * match its schema becomes a `parse` error.
 */
export interface IpcBridgeService {
  /**
   * Invoke a `#[tauri::command]` (snake_case name) and validate the response.
   * The schema input is `unknown`, not `TOutput`: schemas that normalize
   * (`.catch`, `.default`) have a wider input type than output.
   */
  call<TOutput>(
    command: string,
    args: Record<string, unknown>,
    schema: ZodType<TOutput, unknown>,
  ): Promise<TOutput>
  /**
   * {@link call}'s binary sibling: the payload is a raw byte body with
   * per-call metadata in `headers`. Rejects with an `io` {@link AppError}
   * when the transport has no binary path.
   */
  callBinary<TOutput>(
    command: string,
    body: Uint8Array,
    headers: Record<string, string>,
    schema: ZodType<TOutput, unknown>,
  ): Promise<TOutput>
  /** Subscribe to a native event stream, resolving with an unlisten function. */
  listen(event: string, handler: (payload: unknown) => void): Promise<Unlisten>
  /**
   * Attach a raw handler to a plugin event stream. Rejects with an `io`
   * {@link AppError} when the transport has no plugin events.
   */
  listenPlugin(plugin: string, event: string, handler: (payload: unknown) => void): Promise<void>
  /**
   * Subscribe to a plugin event with schema-validated payloads. All
   * subscribers of one event share a single native registration, created on
   * the first subscribe and kept afterwards; a failed registration is dropped
   * so the next subscriber retries. Malformed payloads are dropped with a
   * warning.
   */
  subscribePlugin<Payload>(
    plugin: string,
    event: string,
    schema: ZodType<Payload, unknown>,
    handler: (payload: Payload) => void,
  ): PluginSubscription
  /** True when the transport can carry raw binary bodies. */
  readonly hasBinaryTransport: boolean
  /** True when the transport can deliver plugin events. */
  readonly hasPluginEvents: boolean
}

interface SharedListener<Payload> {
  ready: Promise<void>
  handlers: Set<(payload: Payload) => void>
}

export function createIpcBridgeService(
  transport: IpcBridge,
  deps: { logger: { warn(message: string, cause?: unknown): void } },
): IpcBridgeService {
  const { logger } = deps

  // Heterogeneous (each key carries its own payload type), so entries are
  // stored erased; `subscribePlugin` restores the type its schema defines.
  const pluginListeners = new Map<string, SharedListener<never>>()

  function parseResponse<TOutput>(
    command: string,
    raw: unknown,
    schema: ZodType<TOutput, unknown>,
  ): TOutput {
    const result = schema.safeParse(raw)
    if (!result.success) {
      const appError: AppError = {
        kind: 'parse',
        message: `unexpected response shape from "${command}": ${result.error.message}`,
      }
      throw appError
    }
    return result.data
  }

  function noPluginEvents(plugin: string, event: string): AppError {
    return {
      kind: 'io',
      message: `the installed IPC bridge has no plugin events for "${plugin}:${event}"`,
    }
  }

  async function registerSharedListener<Payload>(
    key: string,
    plugin: string,
    event: string,
    schema: ZodType<Payload, unknown>,
    handlers: Set<(payload: Payload) => void>,
  ): Promise<void> {
    try {
      if (transport.listenPlugin === undefined) {
        throw noPluginEvents(plugin, event)
      }
      await transport.listenPlugin(plugin, event, (raw) => {
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
          logger.warn(`dropping a malformed "${plugin}:${event}" payload`, parsed.error)
          return
        }
        for (const handler of handlers) {
          handler(parsed.data)
        }
      })
    } catch (error) {
      pluginListeners.delete(key)
      throw error
    }
  }

  return {
    async call(command, args, schema) {
      let raw: unknown
      try {
        raw = await transport.invoke(command, args)
      } catch (error) {
        throw toAppError(error)
      }
      return parseResponse(command, raw, schema)
    },

    async callBinary(command, body, headers, schema) {
      if (transport.invokeBinary === undefined) {
        const appError: AppError = {
          kind: 'io',
          message: `the installed IPC bridge has no binary transport for "${command}"`,
        }
        throw appError
      }
      let raw: unknown
      try {
        raw = await transport.invokeBinary(command, body, headers)
      } catch (error) {
        throw toAppError(error)
      }
      return parseResponse(command, raw, schema)
    },

    listen(event, handler) {
      return transport.listen(event, handler)
    },

    async listenPlugin(plugin, event, handler) {
      if (transport.listenPlugin === undefined) {
        throw noPluginEvents(plugin, event)
      }
      await transport.listenPlugin(plugin, event, handler)
    },

    subscribePlugin<Payload>(
      plugin: string,
      event: string,
      schema: ZodType<Payload, unknown>,
      handler: (payload: Payload) => void,
    ): PluginSubscription {
      const key = `${plugin}:${event}`
      let entry = pluginListeners.get(key) as SharedListener<Payload> | undefined
      if (entry === undefined) {
        const handlers = new Set<(payload: Payload) => void>()
        entry = {
          handlers,
          ready: registerSharedListener(key, plugin, event, schema, handlers),
        }
        // A missing `listenPlugin` rejects before this line, so that
        // rejection stays cached: the transport will never gain plugin events.
        pluginListeners.set(key, entry as SharedListener<never>)
      }
      // Wrapped for identity: two subscriptions sharing one handler function
      // must detach independently.
      const deliver = (payload: Payload): void => {
        handler(payload)
      }
      const { handlers } = entry
      handlers.add(deliver)
      return {
        ready: entry.ready,
        unlisten: () => {
          handlers.delete(deliver)
        },
      }
    },

    hasBinaryTransport: transport.invokeBinary !== undefined,
    hasPluginEvents: transport.listenPlugin !== undefined,
  }
}
