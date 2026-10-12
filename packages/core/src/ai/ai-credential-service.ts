import type { SecretStoreService } from '../secrets/secret-store-service.ts'
import type { AiProviderConfig } from '../settings/schema.ts'
import { aiProviderRequiresApiKey } from './provider-catalog.ts'

/**
 * The AI domain's keychain policy: which entries hold BYOK provider keys.
 * The storage primitive itself is the `SecretStoreService` (shared with the
 * GitHub backup token, Plan 12).
 */

/**
 * The keychain account name holding the API key for a configured AI provider
 * (`AiProviderConfig.id` is the stable half of the address).
 */
export function aiKeySecretName(configId: string): string {
  return `ai-api-key:${configId}`
}

/** Reads the stored key of a configured entry by its id. */
export type AiKeyReader = (configId: string) => Promise<string | null>

/** The BYOK API key of each configured AI provider entry. */
export interface AiCredentialService {
  /**
   * Read the key for `config`, returning an empty string for providers that can
   * legitimately run without one (for example a local OpenAI-compatible server).
   * `null` still means "this provider is misconfigured and cannot be called."
   * Keychain read failures propagate: callers keep their own error posture.
   */
  read(config: AiProviderConfig): Promise<string | null>
  /** Stores `apiKey` for the entry `configId`, replacing any prior key. */
  store(configId: string, apiKey: string): Promise<void>
  /** Removes the key of the entry `configId`; a missing key is not an error. */
  remove(configId: string): Promise<void>
  /**
   * A reader for one pass: it reads the stored key of each entry at most
   * once, and a keychain failure reads as `null`.
   */
  createPassReader(): AiKeyReader
}

export function createAiCredentialService(deps: {
  secretStore: SecretStoreService
}): AiCredentialService {
  const { secretStore } = deps
  return {
    async read(config) {
      const apiKey = await secretStore.get(aiKeySecretName(config.id))
      if (apiKey !== null) {
        return apiKey
      }
      if (!aiProviderRequiresApiKey(config.provider) && config.keyHint === '') {
        return ''
      }
      return null
    },
    async store(configId, apiKey) {
      await secretStore.set(aiKeySecretName(configId), apiKey)
    },
    async remove(configId) {
      await secretStore.delete(aiKeySecretName(configId))
    },
    createPassReader() {
      const keys = new Map<string, Promise<string | null>>()
      return (configId) => {
        let key = keys.get(configId)
        if (key === undefined) {
          key = secretStore.get(aiKeySecretName(configId)).catch(() => null)
          keys.set(configId, key)
        }
        return key
      }
    },
  }
}
