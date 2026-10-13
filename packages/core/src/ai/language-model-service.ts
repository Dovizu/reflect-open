import type { LanguageModel } from '@reflect/modules/ai'
import type { HttpService } from '../app/http-service.ts'
import type { AiProviderConfig } from '../settings/schema.ts'
import { anthropicDirectBrowserAccessHeaders } from './anthropic-headers.ts'
import { APP_REVIEW_STUB_KEY, createDemoModel } from './app-review-demo.ts'
import { OPENAI_COMPATIBLE_PROVIDER_ID } from './openai-compatible.ts'
import { OPENROUTER_BASE_URL, openRouterAttributionHeaders } from './openrouter.ts'

/** Loads each provider SDK on first use, so no SDK is in the startup bundle. */
export interface AiSdkLoader {
  openai: () => Promise<Pick<typeof import('@reflect/modules/ai-sdk/openai'), 'createOpenAI'>>
  anthropic: () => Promise<
    Pick<typeof import('@reflect/modules/ai-sdk/anthropic'), 'createAnthropic'>
  >
  google: () => Promise<Pick<typeof import('@reflect/modules/ai-sdk/google'), 'createGoogle'>>
  openaiCompatible: () => Promise<
    Pick<typeof import('@reflect/modules/ai-sdk/openai-compatible'), 'createOpenAICompatible'>
  >
}

/** An {@link AiSdkLoader} over dynamic imports. */
export function createLazyAiSdkLoader(): AiSdkLoader {
  return {
    openai: () => import('@reflect/modules/ai-sdk/openai'),
    anthropic: () => import('@reflect/modules/ai-sdk/anthropic'),
    google: () => import('@reflect/modules/ai-sdk/google'),
    openaiCompatible: () => import('@reflect/modules/ai-sdk/openai-compatible'),
  }
}

/** Turns a configured BYOK entry and its key into a callable language model. */
export interface LanguageModelService {
  /**
   * Build the AI SDK model instance for a configured BYOK entry: the one place
   * provider ids map to SDK factories. Shared by the chat engine
   * (`chat/stream-chat`) and one-shot calls like the link-capture page
   * description (`describe-page`).
   */
  create(config: AiProviderConfig, apiKey: string): Promise<LanguageModel>
}



export function createLanguageModelService(deps: {
  // FIXME: I notice that, unlike what you said in docs/contributing/services.md, in most cases, you did NOT define a type call `interface LanguageModelServiceDeps`. Address this issue for all services. You should define LanguageModelServiceDeps
  http: HttpService
  sdk: AiSdkLoader
}): LanguageModelService {
  const { http, sdk } = deps
  const fetchFn: typeof fetch = (input, init) => http.fetch(input, init)
  return {
    async create(config, apiKey) {
      switch (config.provider) {
        case 'openai': {
          const { createOpenAI } = await sdk.openai()
          return createOpenAI({ apiKey, fetch: fetchFn })(config.model)
        }
        case 'anthropic': {
          const { createAnthropic } = await sdk.anthropic()
          return createAnthropic({
            apiKey,
            fetch: fetchFn,
            headers: anthropicDirectBrowserAccessHeaders(),
          })(config.model)
        }
        case 'google': {
          const { createGoogle } = await sdk.google()
          return createGoogle({ apiKey, fetch: fetchFn })(config.model)
        }
        case 'openrouter': {
          const { createOpenAI } = await sdk.openai()
          return createOpenAI({
            apiKey,
            fetch: fetchFn,
            baseURL: OPENROUTER_BASE_URL,
            headers: openRouterAttributionHeaders(),
            name: 'openrouter',
          }).chat(config.model)
        }
        case 'openai-compatible': {
          const { createOpenAICompatible } = await sdk.openaiCompatible()
          return createOpenAICompatible({
            name: OPENAI_COMPATIBLE_PROVIDER_ID,
            baseURL: config.baseUrl,
            fetch: fetchFn,
            includeUsage: true,
            ...(apiKey.trim() === '' ? {} : { apiKey }),
          }).chatModel(config.model)
        }
      }
    },
  }
}

/**
 * App Review demo mode for `service`: the demo key gets the local demo model
 * regardless of the configured provider, since the reviewer may have picked
 * any of them. Every other key goes to `service`.
 */
export function withAppReviewDemo(service: LanguageModelService): LanguageModelService {
  // FIXME: I don't understand why do we need a seprate withAppReviewDemo function. createLanguageModelService never get called directly. It always get called through withAppReviewDemo. So why not just put the APP_REVIEW_STUB_KEY check inside createLanguageModelService?
  return {
    async create(config, apiKey) {
      if (apiKey === APP_REVIEW_STUB_KEY) {
        return createDemoModel()
      }
      return await service.create(config, apiKey)
    },
  }
}
