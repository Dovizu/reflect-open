import type { AiProviderConfig } from '../settings/schema.ts'
import { defaultAiCredentials } from './ai-credential-service.ts'

export { aiKeySecretName } from './ai-credential-service.ts'

/** The stored key for `config`; see `AiCredentialService.read`. */
export async function aiApiKeyForConfig(config: AiProviderConfig): Promise<string | null> {
  return await defaultAiCredentials().read(config)
}
