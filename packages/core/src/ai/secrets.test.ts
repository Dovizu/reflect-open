import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultSecretStore } from '../secrets/secret-store-service.ts'
import type { HostedAiProviderConfig, OpenAiCompatibleProviderConfig } from '../settings/schema.ts'
import { createTestSecretStoreService } from '../testing/index.ts'
import { aiApiKeyForConfig } from './secrets.ts'

function hostedConfig(overrides: Partial<HostedAiProviderConfig>): HostedAiProviderConfig {
  return {
    id: 'cfg',
    provider: 'openai',
    model: 'gpt-5.4',
    keyHint: '12345',
    ...overrides,
  }
}

function openAiCompatibleConfig(
  overrides: Partial<OpenAiCompatibleProviderConfig>,
): OpenAiCompatibleProviderConfig {
  return {
    id: 'cfg-local',
    provider: 'openai-compatible',
    model: 'llama-local',
    baseUrl: 'http://localhost:1234/v1',
    keyHint: '',
    ...overrides,
  }
}

afterEach(() => {
  setDefaultSecretStore(null)
})

describe('aiApiKeyForConfig', () => {
  it('returns stored keys for configured providers', async () => {
    setDefaultSecretStore(createTestSecretStoreService({ 'ai-api-key:cfg': 'sk-live' }))
    await expect(aiApiKeyForConfig(hostedConfig({}))).resolves.toBe('sk-live')
  })

  it('allows a no-key OpenAI-compatible endpoint', async () => {
    setDefaultSecretStore(createTestSecretStoreService())
    await expect(aiApiKeyForConfig(openAiCompatibleConfig({ keyHint: '' }))).resolves.toBe('')
  })

  it('reports a missing key when an OpenAI-compatible entry was saved with one', async () => {
    setDefaultSecretStore(createTestSecretStoreService())
    await expect(
      aiApiKeyForConfig(openAiCompatibleConfig({ keyHint: '12345' })),
    ).resolves.toBeNull()
  })
})
