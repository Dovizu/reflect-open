import type { ZodType } from 'zod'
import { defaultIpc } from './bridge.ts'

/**
 * Invoke a native command through the installed bridge and validate its
 * response; see `IpcBridgeService.call`. Components and hooks never
 * reach for the bridge (or `@tauri-apps/api`) directly: they call a typed
 * binding (see the per-domain command modules) that funnels through here.
 * On failure this always throws an `AppError`, so callers can branch on
 * `error.kind`.
 */
export async function call<TArgs extends Record<string, unknown>, TOutput>(
  command: string,
  args: TArgs,
  schema: ZodType<TOutput, unknown>,
): Promise<TOutput> {
  return await defaultIpc().call(command, args, schema)
}

/**
 * {@link call}'s binary sibling over the installed bridge; see
 * `IpcBridgeService.callBinary`.
 */
export async function callBinary<TOutput>(
  command: string,
  body: Uint8Array,
  headers: Record<string, string>,
  schema: ZodType<TOutput, unknown>,
): Promise<TOutput> {
  return await defaultIpc().callBinary(command, body, headers, schema)
}
