import { useSyncExternalStore } from 'react'
import {
  defaultAiProviderConfig,
  type AiProviderConfig,
  type AiProviderConfigService,
  type NewAiProvider,
} from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

export type { NewAiProvider } from '@reflect/core'

interface UseAiProvidersValue {
  providers: AiProviderConfig[]
  /** The entry AI features use by default (null only when the list is empty). */
  defaultProvider: AiProviderConfig | null
  /**
   * Store the key in the keychain, then add the settings entry. Rejects (and
   * adds nothing) if the keychain write fails — so an entry can never point
   * at a key that was never stored — or if the settings store could not be
   * read this session, so a key can never be stored for an entry that won't
   * survive a restart.
   */
  addProvider: (draft: NewAiProvider) => Promise<void>
  /** Delete the key from the keychain, then drop the settings entry. */
  removeProvider: (id: string) => Promise<void>
  /** Make the entry with `id` the app-wide default. */
  makeDefault: (id: string) => void
  /** Change the default model used by the configured provider entry. */
  setDefaultModel: (id: string, model: string) => void
}

/** The {@link AiProviderConfigService} of the nearest `AppServicesProvider`, else the process-wide one. */
export function useAiProviderConfigService(): AiProviderConfigService {
  return useAppServices({ optional: true })?.aiProviderConfig ?? defaultAiProviderConfig()
}

/** The configured-AI-providers surface (Plan 10), over the `AiProviderConfigService`. */
export function useAiProviders(): UseAiProvidersValue {
  const service = useAiProviderConfigService()
  const providers = useSyncExternalStore(service.subscribe, service.list)
  const defaultProvider = useSyncExternalStore(service.subscribe, service.defaultProvider)
  return {
    providers,
    defaultProvider,
    addProvider: service.add,
    removeProvider: service.remove,
    makeDefault: service.makeDefault,
    setDefaultModel: service.setDefaultModel,
  }
}
