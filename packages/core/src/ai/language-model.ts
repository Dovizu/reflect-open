import type { LanguageModel } from '@reflect/modules/ai'
import type { AiProviderConfig } from '../settings/schema.ts'
import { defaultLanguageModel } from './language-model-service.ts'

/** The model for a configured BYOK entry; see `LanguageModelService.create`. */
export async function languageModel(
  config: AiProviderConfig,
  apiKey: string,
): Promise<LanguageModel> {
  return await defaultLanguageModel().create(config, apiKey)
}
