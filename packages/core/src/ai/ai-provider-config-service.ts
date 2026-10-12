import type { IdService } from '../app/id-service.ts'
import type { AppError } from '../errors.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import { isHttpBaseUrl, normalizeOpenAICompatibleBaseUrl } from '../lib/http-url.ts'
import type { AiProviderConfig, AiProviderId, ChatModelSelection } from '../settings/schema.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import type { AiCredentialService, AiKeyReader } from './ai-credential-service.ts'
import type { AiKeyValidationService } from './ai-key-validation-service.ts'
import { pickAudioMemoEnrichmentConfig } from './transcript-enrichment-service.ts'
import { chatModelOptions, resolveChatModel, type ChatModelOption } from './chat/model-options.ts'
import { aiProvider, aiProviderRequiresApiKey } from './provider-catalog.ts'
import {
  apiKeyHint,
  defaultAiProvider,
  pickTranscriptionConfig,
  resolveTranscriptionTarget,
  withAiProviderAdded,
  withAiProviderRemoved,
  type AiProvidersState,
  type TranscriptionConfig,
  type TranscriptionMiss,
  type TranscriptionTarget,
} from './provider-config.ts'

/** What the add-provider dialog collects; the key goes to the keychain only. */
export interface NewAiProvider {
  provider: AiProviderId
  model: string
  baseUrl?: string | undefined
  apiKey: string
  isDefault: boolean
}

/** The result of checking a draft before it is saved. */
export type AiProviderDraftCheck =
  /** The draft can be saved; `draft` has the trimmed key and the normalized base URL. */
  | { status: 'ready'; draft: NewAiProvider }
  /** The draft cannot be saved; `message` says why. */
  | { status: 'rejected'; message: string }
  /** The provider could not be reached to verify the key. */
  | { status: 'unreachable' }

/**
 * The configured AI provider entries (Plan 10), and which entry each AI
 * feature uses. This service owns the pairing of the settings document
 * (entries and default id) with the OS keychain (the key itself), so the
 * "settings entry and keychain entry" invariant has one owner.
 */
export interface AiProviderConfigService {
  /** Calls `listener` after any settings change. */
  subscribe: (listener: () => void) => Unlisten
  /** The configured entries, in display order. Stable until the list changes. */
  list: () => AiProviderConfig[]
  /** The entries and the default id, as the pure transforms take them. */
  state: () => AiProvidersState
  /** The entry AI features use by default (`null` only when the list is empty). */
  defaultProvider: () => AiProviderConfig | null
  /**
   * Store the key in the keychain, then add the settings entry. Rejects (and
   * adds nothing) if the keychain write fails, so an entry can never point
   * at a key that was never stored. Also rejects if the settings store could
   * not be read this session, so a key can never be stored for an entry that
   * won't survive a restart.
   */
  add: (draft: NewAiProvider) => Promise<void>
  /** Delete the key from the keychain, then drop the settings entry. */
  remove: (id: string) => Promise<void>
  /** Make the entry with `id` the app-wide default. */
  makeDefault: (id: string) => void
  /** Change the default model used by the configured provider entry. */
  setDefaultModel: (id: string, model: string) => void
  /**
   * Check a draft before {@link AiProviderConfigService.add}: a required key
   * must be present, an OpenAI-compatible entry needs an http(s) base URL,
   * and the key is verified with a live probe. `unverified` skips the probe
   * (the "save anyway" path after an `unreachable` result).
   */
  checkDraft: (
    draft: NewAiProvider,
    options: { unverified: boolean },
  ) => Promise<AiProviderDraftCheck>
  /** Every model the chat picker offers; see {@link chatModelOptions}. */
  chatModelOptions: () => ChatModelOption[]
  /** The entry a chat turn should call, by the saved `chatModelSelection`. */
  chatModel: () => AiProviderConfig | null
  /** Save the chat model choice (`chatModelSelection` in the settings). */
  selectChatModel: (selection: ChatModelSelection | null) => void
  /** The entry audio transcription should run on; see {@link pickTranscriptionConfig}. */
  transcriptionConfig: () => TranscriptionConfig | null
  /**
   * The transcription entry with a usable key; see
   * {@link resolveTranscriptionTarget}. `getKey` defaults to a fresh pass
   * reader of the credential service.
   */
  resolveTranscriptionTarget: (
    getKey?: AiKeyReader,
  ) => Promise<TranscriptionTarget | TranscriptionMiss>
  /** The small-model entry for audio memo enrichment. */
  audioMemoEnrichmentConfig: () => AiProviderConfig | null
}

export function createAiProviderConfigService(deps: {
  settings: Pick<SettingsService, 'get' | 'subscribe' | 'update' | 'updateWith' | 'whenLoaded'>
  credentials: Pick<AiCredentialService, 'store' | 'remove' | 'createPassReader'>
  keyValidation: AiKeyValidationService
  id: Pick<IdService, 'uuid'>
}): AiProviderConfigService {
  const { settings, credentials, keyValidation, id: idService } = deps

  const state = (): AiProvidersState => {
    const current = settings.get()
    return { providers: current.aiProviders, defaultProviderId: current.defaultAiProviderId }
  }

  // Every write goes through `updateWith` so the state is rebuilt from the
  // settings as they are when the update applies, not from a snapshot. The
  // keychain awaits make these genuinely concurrent: a second add/remove can
  // land mid-flight, and a snapshot-based write would clobber it (or
  // resurrect an entry whose key was already deleted).

  return {
    subscribe: (listener) => settings.subscribe(listener),
    list: () => settings.get().aiProviders,
    state,
    defaultProvider: () => defaultAiProvider(state()),
    add: async (draft) => {
      // Refuse before the key touches the keychain: with an unreadable
      // settings store the entry would be session-only, and after a restart
      // the stored key would be orphaned with no UI left to delete it.
      // Awaiting the outcome (rather than reading a flag) also covers an add
      // racing the in-flight load that then fails.
      if ((await settings.whenLoaded()) === 'failed') {
        const error: AppError = {
          kind: 'io',
          message:
            'Settings could not be loaded, so new AI providers cannot be saved. The API key was not stored.',
        }
        throw error
      }
      const id = idService.uuid()
      const apiKey = draft.apiKey.trim()
      if (apiKey !== '' || aiProviderRequiresApiKey(draft.provider)) {
        await credentials.store(id, apiKey)
      }
      settings.updateWith((current) => {
        const entry: AiProviderConfig =
          draft.provider === 'openai-compatible'
            ? {
                id,
                provider: draft.provider,
                model: draft.model,
                baseUrl: normalizeOpenAICompatibleBaseUrl(draft.baseUrl ?? ''),
                keyHint: apiKeyHint(apiKey),
              }
            : {
                id,
                provider: draft.provider,
                model: draft.model,
                keyHint: apiKeyHint(apiKey),
              }
        const next = withAiProviderAdded(
          { providers: current.aiProviders, defaultProviderId: current.defaultAiProviderId },
          entry,
          draft.isDefault,
        )
        return { aiProviders: next.providers, defaultAiProviderId: next.defaultProviderId }
      })
    },
    remove: async (id) => {
      // Keychain first, deliberately. The two stores can't be updated
      // transactionally; interrupted in this order, the leftover is a
      // visibly dead settings row the user can remove again. The reverse
      // order would strand the credential invisibly in the keychain: the
      // keyring API can't enumerate entries, so it could never be swept.
      // The settings write itself is retried by the settings service on failure.
      await credentials.remove(id)
      settings.updateWith((current) => {
        const next = withAiProviderRemoved(
          { providers: current.aiProviders, defaultProviderId: current.defaultAiProviderId },
          id,
        )
        return { aiProviders: next.providers, defaultAiProviderId: next.defaultProviderId }
      })
    },
    makeDefault: (id) => {
      settings.updateWith(() => ({ defaultAiProviderId: id }))
    },
    setDefaultModel: (id, model) => {
      const normalizedModel = model.trim()
      if (normalizedModel === '') {
        return
      }
      settings.updateWith((current) => ({
        aiProviders: current.aiProviders.map((provider) =>
          provider.id === id ? { ...provider, model: normalizedModel } : provider,
        ),
      }))
    },
    checkDraft: async (draft, options) => {
      const apiKey = draft.apiKey.trim()
      const requiresApiKey = aiProviderRequiresApiKey(draft.provider)
      const provider = aiProvider(draft.provider)
      const baseUrl =
        draft.provider === 'openai-compatible'
          ? normalizeOpenAICompatibleBaseUrl(draft.baseUrl ?? '')
          : undefined
      if (requiresApiKey && apiKey === '') {
        return { status: 'rejected', message: 'Enter an API key.' }
      }
      if (
        draft.provider === 'openai-compatible' &&
        (baseUrl === undefined || !isHttpBaseUrl(baseUrl))
      ) {
        return { status: 'rejected', message: 'Enter an http(s) endpoint URL.' }
      }
      if (!options.unverified) {
        const validation = await keyValidation.validate({
          provider: draft.provider,
          apiKey,
          baseUrl,
        })
        if (validation === 'invalid') {
          return {
            status: 'rejected',
            message:
              draft.provider === 'openai-compatible' && apiKey === ''
                ? `${provider.label} endpoint requires an API key.`
                : `${provider.label} rejected this API key.`,
          }
        }
        if (validation === 'unreachable') {
          return { status: 'unreachable' }
        }
      }
      return { status: 'ready', draft: { ...draft, apiKey, baseUrl } }
    },
    chatModelOptions: () => chatModelOptions(settings.get().aiProviders),
    chatModel: () => resolveChatModel(state(), settings.get().chatModelSelection),
    selectChatModel: (selection) => {
      settings.update({ chatModelSelection: selection })
    },
    transcriptionConfig: () => pickTranscriptionConfig(state()),
    resolveTranscriptionTarget: async (getKey) =>
      await resolveTranscriptionTarget(state(), getKey ?? credentials.createPassReader()),
    audioMemoEnrichmentConfig: () => pickAudioMemoEnrichmentConfig(state()),
  }
}
