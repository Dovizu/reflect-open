import { createTestLoggerService } from './logger.ts'
import { ReflectError } from '../errors.ts'
import { setBridge } from '../ipc/bridge.ts'
import {
  createIpcBridgeService,
  type IpcBridge,
  type IpcBridgeService,
  type Unlisten,
} from '../ipc/ipc-service.ts'

type CommandHandler = (args: Record<string, unknown>) => unknown
type BinaryCommandHandler = (body: Uint8Array, headers: Record<string, string>) => unknown

export interface TestIpcBridgeService extends IpcBridgeService {
  /** The fake transport the service wraps. */
  readonly transport: IpcBridge
  onCommand(command: string, handler: (args: Record<string, unknown>) => unknown): void
  onBinaryCommand(
    command: string,
    handler: (body: Uint8Array, headers: Record<string, string>) => unknown,
  ): void
  emit(event: string, payload: unknown): void
  emitPlugin(plugin: string, event: string, payload: unknown): void
  calls(): readonly { command: string; args: Record<string, unknown> }[]
}

export interface TestIpcBridgeServiceOptions {
  commands?: Record<string, CommandHandler> | undefined
  /** Give the transport a binary path. Defaults to `true`. */
  binary?: boolean | undefined
  /** Give the transport plugin events. Defaults to `true`. */
  pluginEvents?: boolean | undefined
  logger?: { warn(message: string, cause?: unknown): void } | undefined
}

/**
 * An in-memory {@link IpcBridgeService}. Commands answer from registered
 * handlers; an unregistered command rejects with an `unknown` `AppError`.
 */
export function createTestIpcBridgeService(
  options?: TestIpcBridgeServiceOptions,
): TestIpcBridgeService {
  const commands = new Map<string, CommandHandler>(Object.entries(options?.commands ?? {}))
  const binaryCommands = new Map<string, BinaryCommandHandler>()
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>()
  const pluginHandlers = new Map<string, Set<(payload: unknown) => void>>()
  const log: { command: string; args: Record<string, unknown> }[] = []

  function addHandler(
    registry: Map<string, Set<(payload: unknown) => void>>,
    key: string,
    handler: (payload: unknown) => void,
  ): Unlisten {
    let handlers = registry.get(key)
    if (handlers === undefined) {
      handlers = new Set()
      registry.set(key, handlers)
    }
    // Wrapped for identity, so registering one function twice detaches independently.
    const deliver = (payload: unknown): void => {
      handler(payload)
    }
    handlers.add(deliver)
    return () => {
      handlers.delete(deliver)
    }
  }

  function dispatch(
    registry: Map<string, Set<(payload: unknown) => void>>,
    key: string,
    payload: unknown,
  ): void {
    for (const handler of registry.get(key) ?? []) {
      handler(payload)
    }
  }

  const transport: IpcBridge = {
    invoke: async (command, args) => {
      log.push({ command, args })
      const handler = commands.get(command)
      if (handler === undefined) {
        throw new ReflectError('unknown', `test bridge: unimplemented command "${command}"`)
      }
      return await handler(args)
    },
    listen: async (event, handler) => addHandler(eventHandlers, event, handler),
  }
  if (options?.binary ?? true) {
    transport.invokeBinary = async (command, body, headers) => {
      log.push({ command, args: { headers } })
      const handler = binaryCommands.get(command)
      if (handler === undefined) {
        throw new ReflectError('unknown', `test bridge: unimplemented command "${command}"`)
      }
      return await handler(body, headers)
    }
  }
  if (options?.pluginEvents ?? true) {
    transport.listenPlugin = async (plugin, event, handler) => {
      addHandler(pluginHandlers, `${plugin}:${event}`, handler)
    }
  }

  const service = createIpcBridgeService(transport, {
    logger: options?.logger ?? createTestLoggerService(),
  })

  return {
    ...service,
    transport,
    onCommand(command, handler) {
      commands.set(command, handler)
    },
    onBinaryCommand(command, handler) {
      binaryCommands.set(command, handler)
    },
    emit(event, payload) {
      dispatch(eventHandlers, event, payload)
    },
    emitPlugin(plugin, event, payload) {
      dispatch(pluginHandlers, `${plugin}:${event}`, payload)
    },
    calls() {
      return [...log]
    },
  }
}

/**
 * Install `service`'s transport as the process-wide bridge, returning a
 * function that removes it again.
 */
export function installTestBridge(service: TestIpcBridgeService): () => void {
  setBridge(service.transport)
  return () => {
    setBridge(null)
  }
}
