import type { ZodType } from 'zod'
import type { LoggerService } from '../app/logger-service.ts'
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
}

// FIXME: for all new functions / interfaces etc.added in this pull request.use the following pattern for jsdoc.
//
// BAD:
// /** True when the transport can carry raw binary bodies. */
// readonly hasBinaryTransport: boolean
//
// GOOD:
// /**
//  * True when the transport can carry raw binary bodies.
//  */
// readonly hasBinaryTransport: boolean
//

interface SharedListener<Payload> {
  ready: Promise<void>
  fanOut: FanOut<Payload>
}

// FIXME:
// I feel that returning a literal object in createXxxxService is bad for readability and maintainability. Let's consider refactoring this to a class-based implementation. use this patter:
// 1. we have an interface call `export interface FooService`, just like what we're doing now.
// 2. we have a class `class FooServiceImpl implements FooService` that implements the interface.
// 3. we export a function `export function createFooService(): FooService { return new FooServiceImpl() }`.
// 4. Only FooService and createFooService are exported, FooServiceImpl is not exported. In other words, `FooServiceImpl` is just an implementation detail. We do not force the caller to understand that the underlying implementation is a class. If we want, we can use an object-based implementation without changing any callers.
// 5. inside the class, try to avoid using getter and setter. Just use plain `getXxxValue()` and `setXxxValue()` methods.
// 6. inside the class, try to avoid using `private`. use `#` instead.
// 7. I knonw in reflect-open's document, we said "we perfer object to class". Update the document to correct this and refer to the new pattern.
// 8. Use many cheap sub-agents to do this migration.

export function createIpcBridgeService(
  transport: IpcBridge,
  deps: { logger: LoggerService },
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
    emit: (payload: Payload) => void,
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
        emit(parsed.data)
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
        const fanOut = createFanOut<Payload>()
        entry = {
          fanOut,
          ready: registerSharedListener(key, plugin, event, schema, fanOut.emit),
        }
        // A missing `listenPlugin` rejects before this line, so that
        // rejection stays cached: the transport will never gain plugin events.
        pluginListeners.set(key, entry as SharedListener<never>)
      }
      return {
        ready: entry.ready,
        unlisten: entry.fanOut.subscribe(handler),
      }
    },

    hasBinaryTransport: transport.invokeBinary !== undefined,
  }
}

/** A set of handlers fed by one shared source. */
export interface FanOut<T> {
  /**
   * Add a handler and return its detach. The first handler starts the source;
   * the last detach stops it.
   */
  subscribe(handler: (value: T) => void): Unlisten
  /** Deliver `value` to every current handler. */
  emit(this: void, value: T): void
}

/**
 * Create a {@link FanOut}. `start` registers the shared source, feeding it
 * `emit`, and returns its teardown; without it, values arrive only through
 * `emit`.
 */
export function createFanOut<T>(start?: (emit: (value: T) => void) => Unlisten): FanOut<T> {
  const handlers = new Set<(value: T) => void>()
  let stop: Unlisten | null = null

  function emit(value: T): void {
    for (const handler of handlers) {
      handler(value)
    }
  }

  return {
    subscribe(handler) {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver = (value: T): void => {
        handler(value)
      }
      handlers.add(deliver)
      if (stop === null && start !== undefined) {
        stop = start(emit)
      }
      return () => {
        if (!handlers.delete(deliver) || handlers.size > 0 || stop === null) {
          return
        }
        const teardown = stop
        stop = null
        teardown()
      }
    },
    emit,
  }
}

/**
 * Run an asynchronous subscription and return its teardown at once. The
 * teardown also cancels a registration that lands later; a failed
 * registration goes to `onError`.
 */
export function listenNow(
  register: () => Promise<Unlisten>,
  onError: (cause: unknown) => void,
): Unlisten {
  let disposed = false
  let unlisten: Unlisten | null = null
  let pending: Promise<Unlisten>
  try {
    pending = register()
  } catch (error) {
    pending = Promise.reject(error)
  }
  void pending.then(
    (registered) => {
      if (disposed) {
        registered()
      } else {
        unlisten = registered
      }
    },
    (error: unknown) => {
      if (!disposed) {
        onError(error)
      }
    },
  )
  return () => {
    disposed = true
    unlisten?.()
    unlisten = null
  }
}
