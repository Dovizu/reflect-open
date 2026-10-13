import type { LanguageModel } from '@reflect/modules/ai'
import { MockLanguageModelV3 } from '@reflect/modules/ai/test'
import type {
  AiKeyValidationService,
  ApiKeyValidation,
  ApiKeyValidationInput,
} from '../ai/ai-key-validation-service.ts'
import type { LanguageModelService } from '../ai/language-model-service.ts'
import type { AssetDescriberService, DescribeAssetRequest } from '../ai/asset-describer-service.ts'
import type {
  DescribePageRequest,
  PageDescriberService,
  PageEnrichment,
} from '../ai/page-describer-service.ts'
import {
  createTranscriptionService,
  type TranscriptionRequest,
  type TranscriptionService,
} from '../ai/transcription-service.ts'
import type { AiProviderConfig } from '../settings/schema.ts'

/**
 * A model, or a function that answers each `create` call.
 */
export type TestLanguageModelSource =
  | LanguageModel
  | ((config: AiProviderConfig, apiKey: string) => LanguageModel | Promise<LanguageModel>)

/**
 * A `create` call the fake received.
 */
export interface TestLanguageModelCall {
  config: AiProviderConfig
  apiKey: string
}

export interface TestLanguageModelService extends LanguageModelService {
  /**
   * Every `create` call, in order.
   */
  calls(): readonly TestLanguageModelCall[]
  /**
   * Replaces the model that later `create` calls answer with.
   */
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

export interface TestAiKeyValidationService extends AiKeyValidationService {
  /**
   * Every input passed to `validate()`, in order.
   */
  calls(): readonly ApiKeyValidationInput[]
  /**
   * Replaces the result that later `validate()` calls answer with.
   */
  setResult(result: ApiKeyValidation): void
}

/**
 * An {@link AiKeyValidationService} that answers `result` without any request.
 */
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

/**
 * A page enrichment, or a function that answers each `describe` call.
 */
export type TestPageDescriberSource =
  | PageEnrichment
  | ((request: DescribePageRequest) => PageEnrichment | Promise<PageEnrichment>)

export interface TestPageDescriberService extends PageDescriberService {
  /**
   * Every request passed to `describe()`, in order.
   */
  calls(): readonly DescribePageRequest[]
  /**
   * Replaces the result that later `describe()` calls answer with.
   */
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

/**
 * A description, or a function that answers each `describe` call.
 */
export type TestAssetDescriberSource =
  | string
  | ((request: DescribeAssetRequest) => string | Promise<string>)

export interface TestAssetDescriberService extends AssetDescriberService {
  /**
   * Every request passed to `describe()`, in order.
   */
  calls(): readonly DescribeAssetRequest[]
  /**
   * Replaces the result that later `describe()` calls answer with.
   */
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

/**
 * A transcript, or a function that answers each `transcribe` call.
 */
export type TestTranscriptionSource =
  | string
  | ((request: TranscriptionRequest) => string | Promise<string>)

export interface TestTranscriptionService extends TranscriptionService {
  /**
   * Every request passed to `transcribe()`, in order.
   */
  calls(): readonly TranscriptionRequest[]
  /**
   * Replaces the result that later `transcribe()` calls answer with.
   */
  setResult(result: TestTranscriptionSource): void
}

/**
 * A {@link TranscriptionService} that answers `result` without any request:
 * an empty transcript by default. `sessionTranscript` is the real one, so the
 * App Review demo key gets its canned transcript.
 */
export function createTestTranscriptionService(
  result: TestTranscriptionSource = '',
): TestTranscriptionService {
  let source = result
  const log: TranscriptionRequest[] = []
  const real = createTranscriptionService({
    http: {
      fetch: () => Promise.reject(new Error('The test transcription service has no network')),
    },
  })
  return {
    transcribe: async (request) => {
      log.push(request)
      return typeof source === 'function' ? await source(request) : source
    },
    sessionTranscript: (apiKey) => real.sessionTranscript(apiKey),
    calls: () => [...log],
    setResult(next) {
      source = next
    },
  }
}
