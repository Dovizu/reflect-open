import { vi, type Mock, type MockInstance } from 'vitest'
import type { CaptureEnvelope } from './capture-envelope.ts'
import { captureIdentity } from './capture-identity.ts'
import { aiKeySecretName } from '../ai/ai-credential-service.ts'
import type { PageDescriberService } from '../ai/page-describer-service.ts'
import type { AiProvidersState } from '../ai/provider-config.ts'
import type { WebFetchService } from '../app/web-fetch-service.ts'
import type { AssetStoreService } from '../graph/asset-store-service.ts'
import type { CaptureInboxService } from '../graph/capture-inbox-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { SecretStoreService } from '../secrets/secret-store-service.ts'
import {
  createTestAiCredentialService,
  createTestAiProviderConfigService,
  createTestAssetStoreService,
  createTestCaptureInboxService,
  createTestClockService,
  createTestHashService,
  createTestLoggerService,
  createTestNoteFileService,
  createTestPageDescriberService,
  createTestPrivacyService,
  createTestSecretStoreService,
  createTestSettingsService,
  createTestWebFetchService,
  createTestXArchiveService,
  type TestCaptureInboxService,
  type TestClockService,
  type TestNoteFileService,
  type TestSecretStoreService,
  type TestXArchiveService,
} from '../testing/index.ts'
import type { BacklinkTargetService } from './backlink-target-service.ts'
import {
  createCaptureDrainService,
  type DrainCaptureInboxInput,
  type DrainCaptureInboxOutcome,
} from './capture-drain-service.ts'
import {
  createCaptureEnrichmentService,
  type ReconcileCaptureEnrichmentInput,
  type ReconcileCaptureEnrichmentOutcome,
} from './capture-enrichment-service.ts'
import type { PageMetaService } from './page-meta-service.ts'

/**
 * Shared setup for the capture test files (`capture-drain-service.test.ts`,
 * `capture-enrichment-service.test.ts`): the two capture phases over one set
 * of in-memory services, so a drain's writes are visible to its own dedup
 * lookups, to later drains, and to the enrichment pass — the cross-step
 * behavior the contracts are about.
 */

export const PROVIDERS: AiProvidersState = {
  providers: [{ id: 'cfg-openai', provider: 'openai', model: 'gpt-5.5', keyHint: 'wxyz1' }],
  defaultProviderId: 'cfg-openai',
}
export const NO_PROVIDERS: AiProvidersState = { providers: [], defaultProviderId: null }

/** The keychain entry holding the API key of the provider in {@link PROVIDERS}. */
export const API_KEY_SECRET = aiKeySecretName('cfg-openai')

/** 2026-06-11 15:30:22.845 local — every derived name is asserted from it. */
export const CAPTURED_AT = new Date(2026, 5, 11, 15, 30, 22, 845)
export const IDENTITY = captureIdentity(CAPTURED_AT, '7c9e6679-7425-40de-944b-e07fc1f90ae7')
export const DAILY = 'daily/2026-06-11.md'
export const CAPTURE_URL = 'https://example.com/article'

export function envelope(overrides: Partial<CaptureEnvelope> = {}): CaptureEnvelope {
  return {
    version: 1,
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    url: CAPTURE_URL,
    title: 'An article',
    capturedAt: CAPTURED_AT.toISOString(),
    source: 'extension',
    ...overrides,
  }
}

export interface CaptureTestKit {
  /** The in-memory graph notes. */
  noteFile: TestNoteFileService
  /** The in-memory spool (`.reflect/inbox/`). */
  captureInbox: TestCaptureInboxService
  xArchive: TestXArchiveService
  clock: TestClockService
  writeNoteMock: MockInstance<NoteFileService['write']>
  inboxRemoveMock: MockInstance<CaptureInboxService['remove']>
  promoteMock: MockInstance<CaptureInboxService['promoteScreenshot']>
  readAssetMock: MockInstance<AssetStoreService['readBase64']>
  writeAssetMock: MockInstance<AssetStoreService['writeBase64']>
  linkPreviewMock: MockInstance<WebFetchService['fetchLinkPreviewImage']>
  scrapeMock: Mock<PageMetaService['scrape']>
  describeMock: MockInstance<PageDescriberService['describe']>
  ensureBacklinkTargetMock: Mock<BacklinkTargetService['ensure']>
  /** Replace the keychain with a fresh one holding `initial` and return it. */
  installSecrets(initial?: Record<string, string>): TestSecretStoreService
  /** Replace the keychain with one whose reads reject with `error`. */
  installFailingSecrets(error: Error): void
  /** Spool one capture (envelope JSON + screenshot sibling unless disabled). */
  addSpool(capture: CaptureEnvelope, options?: { screenshot?: boolean; modifiedMs?: number }): void
  /** Run the drain at generation 3. */
  drain(overrides?: Partial<DrainCaptureInboxInput>): Promise<DrainCaptureInboxOutcome>
  /** Run the enrichment pass at generation 3, with {@link PROVIDERS} configured unless overridden. */
  reconcile(
    overrides?: Partial<ReconcileCaptureEnrichmentInput> & { providers?: AiProvidersState },
  ): Promise<ReconcileCaptureEnrichmentOutcome>
}

/** Fresh in-memory services with the capture phases built on them; call from `beforeEach`. */
export function createCaptureTestKit(): CaptureTestKit {
  const noteFile = createTestNoteFileService()
  const captureInbox = createTestCaptureInboxService()
  const assetStore = createTestAssetStoreService()
  const webFetch = createTestWebFetchService()
  const xArchive = createTestXArchiveService()
  const pageDescriber = createTestPageDescriberService({
    title: null,
    description: 'An AI description of the page.',
  })
  const hash = createTestHashService()
  const clock = createTestClockService({ now: Date.now() })
  let secretStore: SecretStoreService = createTestSecretStoreService({
    [API_KEY_SECRET]: 'sk-live-key',
  })

  const scrapeMock = vi
    .fn<PageMetaService['scrape']>()
    .mockResolvedValue({ title: 'An article', description: null, siteName: null })
  const ensureBacklinkTargetMock = vi
    .fn<BacklinkTargetService['ensure']>()
    .mockResolvedValue('Links')
  // The inbox fake promotes without writing the asset, so every screenshot reads as these bytes.
  const readAssetMock = vi.spyOn(assetStore, 'readBase64').mockResolvedValue(btoa('jpeg-bytes'))

  const drainService = createCaptureDrainService({
    captureInbox,
    noteFile,
    xArchive,
    backlinkTarget: { ensure: ensureBacklinkTargetMock },
    hash,
    clock,
    logger: createTestLoggerService(),
  })

  return {
    noteFile,
    captureInbox,
    xArchive,
    clock,
    writeNoteMock: vi.spyOn(noteFile, 'write'),
    inboxRemoveMock: vi.spyOn(captureInbox, 'remove'),
    promoteMock: vi.spyOn(captureInbox, 'promoteScreenshot'),
    readAssetMock,
    writeAssetMock: vi.spyOn(assetStore, 'writeBase64'),
    linkPreviewMock: vi.spyOn(webFetch, 'fetchLinkPreviewImage'),
    scrapeMock,
    describeMock: vi.spyOn(pageDescriber, 'describe'),
    ensureBacklinkTargetMock,
    installSecrets(initial = {}) {
      const store = createTestSecretStoreService(initial)
      secretStore = store
      return store
    },
    installFailingSecrets(error) {
      secretStore = {
        ...createTestSecretStoreService(),
        get: async () => {
          throw error
        },
      }
    },
    addSpool(capture, options = {}) {
      const withRef = {
        ...capture,
        screenshotRef: options.screenshot === false ? undefined : `${capture.id}.jpg`,
      }
      const modifiedMs = options.modifiedMs ?? 0
      captureInbox.add(`${capture.id}.json`, withRef, { modifiedMs })
      if (options.screenshot !== false) {
        captureInbox.add(`${capture.id}.jpg`, 'jpeg', { modifiedMs })
      }
    },
    drain: (overrides = {}) => drainService.drain({ generation: 3, ...overrides }),
    async reconcile(overrides = {}) {
      const { providers = PROVIDERS, ...input } = overrides
      const settings = createTestSettingsService({
        aiProviders: providers.providers,
        defaultAiProviderId: providers.defaultProviderId,
      })
      await settings.whenLoaded()
      const enrichment = createCaptureEnrichmentService({
        noteFile,
        assetStore,
        webFetch,
        pageMeta: { scrape: scrapeMock },
        pageDescriber,
        aiProviderConfig: createTestAiProviderConfigService({ settings }),
        aiCredentials: createTestAiCredentialService({ secretStore }),
        privacy: createTestPrivacyService({ noteFile }),
        hash,
      })
      return await enrichment.reconcile({ generation: 3, ...input })
    },
  }
}
