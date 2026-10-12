import type { LanguageModel } from '@reflect/modules/ai'
import { MockLanguageModelV3 } from '@reflect/modules/ai/test'
import { createAiCredentialService, type AiCredentialService } from '../ai/ai-credential-service.ts'
import type {
  AiKeyValidationService,
  ApiKeyValidation,
  ApiKeyValidationInput,
} from '../ai/ai-key-validation-service.ts'
import { createAiPromptService, type AiPromptService } from '../ai/ai-prompt-service.ts'
import type { LanguageModelService } from '../ai/language-model-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { SecretStoreService } from '../secrets/secret-store-service.ts'
import type { AiProviderConfig } from '../settings/schema.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import { createTestIdService } from './id.ts'
import { createTestSecretStoreService } from './secrets.ts'
import { createTestSettingsService } from './settings.ts'

/** A model, or a function that answers each `create` call. */
export type TestLanguageModelSource =
  | LanguageModel
  | ((config: AiProviderConfig, apiKey: string) => LanguageModel | Promise<LanguageModel>)

/** A `create` call the fake received. */
export interface TestLanguageModelCall {
  config: AiProviderConfig
  apiKey: string
}

export interface TestLanguageModelService extends LanguageModelService {
  /** Every `create` call, in order. */
  calls(): readonly TestLanguageModelCall[]
  /** Replaces the model that later `create` calls answer with. */
  setModel(model: TestLanguageModelSource): void
}

/**
 * A {@link LanguageModelService} that answers every `create` call with
 * `model`, an empty `MockLanguageModelV3` by default. No provider SDK loads
 * and no request leaves the process.
 */
export function createTestLanguageModelService(
  model: TestLanguageModelSource = new MockLanguageModelV3(),
): TestLanguageModelService {
  let source = model
  const log: TestLanguageModelCall[] = []
  return {
    async create(config, apiKey) {
      log.push({ config, apiKey })
      return typeof source === 'function' ? await source(config, apiKey) : source
    },
    calls: () => [...log],
    setModel(next) {
      source = next
    },
  }
}

export interface TestAiCredentialServiceOptions {
  /** The keychain the keys live in; defaults to an empty test secret store. */
  secretStore?: SecretStoreService
}

/** The real {@link AiCredentialService} over a test secret store. */
export function createTestAiCredentialService(
  options?: TestAiCredentialServiceOptions,
): AiCredentialService {
  return createAiCredentialService({
    secretStore: options?.secretStore ?? createTestSecretStoreService(),
  })
}

export interface TestAiKeyValidationService extends AiKeyValidationService {
  /** Every input passed to `validate()`, in order. */
  calls(): readonly ApiKeyValidationInput[]
  /** Replaces the result that later `validate()` calls answer with. */
  setResult(result: ApiKeyValidation): void
}

/** An {@link AiKeyValidationService} that answers `result` without any request. */
export function createTestAiKeyValidationService(
  result: ApiKeyValidation = 'valid',
): TestAiKeyValidationService {
  let current = result
  const log: ApiKeyValidationInput[] = []
  return {
    async validate(input) {
      log.push(input)
      return current
    },
    calls: () => [...log],
    setResult(next) {
      current = next
    },
  }
}

export interface TestAiPromptServiceOptions {
  /** The settings the prompts live in; defaults to an empty test settings service. */
  settings?: SettingsService
  /** Mints the prompt ids; defaults to a test id service. */
  id?: IdService
}

/** The real {@link AiPromptService} over test settings and deterministic ids. */
export function createTestAiPromptService(options?: TestAiPromptServiceOptions): AiPromptService {
  return createAiPromptService({
    settings: options?.settings ?? createTestSettingsService(),
    id: options?.id ?? createTestIdService(),
  })
}
