import {
  defaultAiKeyValidation,
  type ApiKeyValidation,
  type ApiKeyValidationInput,
} from './ai-key-validation-service.ts'

export type { ApiKeyValidation, ApiKeyValidationInput } from './ai-key-validation-service.ts'

/** Probe `input.provider` with `input.apiKey`; see `AiKeyValidationService.validate`. */
export async function validateApiKey(input: ApiKeyValidationInput): Promise<ApiKeyValidation> {
  return await defaultAiKeyValidation().validate(input)
}
