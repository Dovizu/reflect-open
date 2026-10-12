import type { LanguageModel } from '@reflect/modules/ai'
import { MockLanguageModelV3 } from '@reflect/modules/ai/test'
import { createAiCredentialService, type AiCredentialService } from '../ai/ai-credential-service.ts'
import type {
  AiKeyValidationService,
  ApiKeyValidation,
  ApiKeyValidationInput,
} from '../ai/ai-key-validation-service.ts'
import { createAiPromptService, type AiPromptService } from '../ai/ai-prompt-service.ts'
import {
  createAiProviderConfigService,
  type AiProviderConfigService,
} from '../ai/ai-provider-config-service.ts'
import type { LanguageModelService } from '../ai/language-model-service.ts'
import type { AssetDescriberService, DescribeAssetRequest } from '../ai/asset-describer-service.ts'
import type {
  DescribePageRequest,
  PageDescriberService,
  PageEnrichment,
} from '../ai/page-describer-service.ts'
import {
  createSelectionTransformService,
  type SelectionTransformService,
} from '../ai/selection-transform-service.ts'
import {
  createTranscriptEnrichmentService,
  type TranscriptEnrichmentService,
} from '../ai/transcript-enrichment-service.ts'
import type { TranscriptionRequest, TranscriptionService } from '../ai/transcription-service.ts'
import type { PrivacyService } from '../privacy/privacy-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { SecretStoreService } from '../secrets/secret-store-service.ts'
import type { AiProviderConfig } from '../settings/schema.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import { createTestIdService } from './id.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestPrivacyService } from './privacy.ts'
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

export interface TestAiProviderConfigServiceOptions {
  /** The settings the entries live in; defaults to an empty test settings service. */
  settings?: SettingsService
  /** Holds the keys; defaults to a credential service over an empty test secret store. */
  credentials?: AiCredentialService
  /** Verifies the keys; defaults to a fake that answers `valid`. */
  keyValidation?: AiKeyValidationService
  /** Mints the entry ids; defaults to a test id service. */
  id?: IdService
}

/** The real {@link AiProviderConfigService} over test settings, credentials, key validation and ids. */
export function createTestAiProviderConfigService(
  options?: TestAiProviderConfigServiceOptions,
): AiProviderConfigService {
  return createAiProviderConfigService({
    settings: options?.settings ?? createTestSettingsService(),
    credentials: options?.credentials ?? createTestAiCredentialService(),
    keyValidation: options?.keyValidation ?? createTestAiKeyValidationService(),
    id: options?.id ?? createTestIdService(),
  })
}

export interface TestSelectionTransformServiceOptions {
  /** Receives a failed stream; defaults to a test logger. */
  logger?: LoggerService
  /** Builds the model; defaults to a test language model service. */
  languageModel?: LanguageModelService
  /** The configured entries; defaults to a provider config service with no entries. */
  providerConfig?: AiProviderConfigService
  /** Holds the keys; defaults to a credential service over an empty test secret store. */
  credentials?: AiCredentialService
  /** The privacy gate; defaults to a test privacy service. */
  privacy?: PrivacyService
}

/** The real {@link SelectionTransformService} over test services. */
export function createTestSelectionTransformService(
  options?: TestSelectionTransformServiceOptions,
): SelectionTransformService {
  return createSelectionTransformService({
    logger: options?.logger ?? createTestLoggerService(),
    languageModel: options?.languageModel ?? createTestLanguageModelService(),
    providerConfig: options?.providerConfig ?? createTestAiProviderConfigService(),
    credentials: options?.credentials ?? createTestAiCredentialService(),
    privacy: options?.privacy ?? createTestPrivacyService(),
  })
}

/** A page enrichment, or a function that answers each `describe` call. */
export type TestPageDescriberSource =
  | PageEnrichment
  | ((request: DescribePageRequest) => PageEnrichment | Promise<PageEnrichment>)

export interface TestPageDescriberService extends PageDescriberService {
  /** Every request passed to `describe()`, in order. */
  calls(): readonly DescribePageRequest[]
  /** Replaces the result that later `describe()` calls answer with. */
  setResult(result: TestPageDescriberSource): void
}

/**
 * A {@link PageDescriberService} that answers `result` without any provider
 * call: no title and an empty description by default.
 */
export function createTestPageDescriberService(
  result: TestPageDescriberSource = { title: null, description: '' },
): TestPageDescriberService {
  let source = result
  const log: DescribePageRequest[] = []
  return {
    describe: async (request) => {
      log.push(request)
      return typeof source === 'function' ? await source(request) : source
    },
    calls: () => [...log],
    setResult(next) {
      source = next
    },
  }
}

/** A description, or a function that answers each `describe` call. */
export type TestAssetDescriberSource =
  | string
  | ((request: DescribeAssetRequest) => string | Promise<string>)

export interface TestAssetDescriberService extends AssetDescriberService {
  /** Every request passed to `describe()`, in order. */
  calls(): readonly DescribeAssetRequest[]
  /** Replaces the result that later `describe()` calls answer with. */
  setResult(result: TestAssetDescriberSource): void
}

/**
 * An {@link AssetDescriberService} that answers `result` without any provider
 * call: an empty description by default.
 */
export function createTestAssetDescriberService(
  result: TestAssetDescriberSource = '',
): TestAssetDescriberService {
  let source = result
  const log: DescribeAssetRequest[] = []
  return {
    describe: async (request) => {
      log.push(request)
      return typeof source === 'function' ? await source(request) : source
    },
    calls: () => [...log],
    setResult(next) {
      source = next
    },
  }
}

/** A transcript, or a function that answers each `transcribe` call. */
export type TestTranscriptionSource =
  | string
  | ((request: TranscriptionRequest) => string | Promise<string>)

export interface TestTranscriptionService extends TranscriptionService {
  /** Every request passed to `transcribe()`, in order. */
  calls(): readonly TranscriptionRequest[]
  /** Replaces the result that later `transcribe()` calls answer with. */
  setResult(result: TestTranscriptionSource): void
}

/**
 * A {@link TranscriptionService} that answers `result` without any request:
 * an empty transcript by default.
 */
export function createTestTranscriptionService(
  result: TestTranscriptionSource = '',
): TestTranscriptionService {
  let source = result
  const log: TranscriptionRequest[] = []
  return {
    transcribe: async (request) => {
      log.push(request)
      return typeof source === 'function' ? await source(request) : source
    },
    sessionTranscript: () => null,
    calls: () => [...log],
    setResult(next) {
      source = next
    },
  }
}

export interface TestTranscriptEnrichmentServiceOptions {
  /** Builds the model; defaults to a test language model service. */
  languageModel?: LanguageModelService
}

/** The real {@link TranscriptEnrichmentService} over a test language model service. */
export function createTestTranscriptEnrichmentService(
  options?: TestTranscriptEnrichmentServiceOptions,
): TranscriptEnrichmentService {
  return createTranscriptEnrichmentService({
    languageModel: options?.languageModel ?? createTestLanguageModelService(),
  })
}
