import { z } from 'zod'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'

/**
 * The OS keychain. Every credential (BYOK AI keys, the GitHub backup token)
 * goes through here and only here: never into markdown, Git, `.reflect/`,
 * or the settings document. Which names exist is each domain's policy.
 */
export interface SecretStoreService {
  /** The secret stored under `name`, or `null` when none exists. */
  get(name: string): Promise<string | null>
  /** Stores `value` under `name`, replacing any prior value. */
  set(name: string, value: string): Promise<void>
  /** Removes the secret stored under `name`; a missing entry is not an error. */
  delete(name: string): Promise<void>
}

/** Commands that return `()` from Rust serialize as `null` over IPC. */
const voidSchema = z.null()

const secretSchema = z.string().nullable()

/** A keychain over the `secret_get`, `secret_set` and `secret_delete` commands. */
export function createSecretStoreService(deps: { ipc: IpcBridgeService }): SecretStoreService {
  const { ipc } = deps
  return {
    async get(name) {
      return await ipc.call('secret_get', { name }, secretSchema)
    },
    async set(name, value) {
      await ipc.call('secret_set', { name, value }, voidSchema)
    },
    async delete(name) {
      await ipc.call('secret_delete', { name }, voidSchema)
    },
  }
}

let defaultSecretStoreInstance: SecretStoreService | null = null

/**
 * The process-wide keychain; one over the bridge installed at call time
 * unless {@link setDefaultSecretStore} installed another.
 */
export function defaultSecretStore(): SecretStoreService {
  defaultSecretStoreInstance ??= createSecretStoreService({ ipc: currentIpc() })
  return defaultSecretStoreInstance
}

/** Installs the process-wide keychain; `null` restores the bridge-backed one. */
export function setDefaultSecretStore(service: SecretStoreService | null): void {
  defaultSecretStoreInstance = service
}
