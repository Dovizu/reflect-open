import { createIndexReadServices, type AppServices } from '../app/create-app-services.ts'
import {
  createGraphServices,
  type GraphRole,
  type GraphServices,
} from '../app/create-graph-services.ts'
import { createGraphSession, type GraphSession } from '../app/graph-session.ts'
import { installDefaultServices, resetDefaultServices } from '../app/install-default-services.ts'
import type { PathService } from '../app/path-service.ts'
import type { AppInfoService } from '../app/app-info-service.ts'
import type { AiCredentialService } from '../ai/ai-credential-service.ts'
import type { AiPromptService } from '../ai/ai-prompt-service.ts'
import type { AiProviderConfigService } from '../ai/ai-provider-config-service.ts'
import type { SelectionTransformService } from '../ai/selection-transform-service.ts'
import type { TranscriptEnrichmentService } from '../ai/transcript-enrichment-service.ts'
import {
  createTestAiCredentialService,
  createTestAiKeyValidationService,
  createTestAiPromptService,
  createTestAiProviderConfigService,
  createTestAssetDescriberService,
  createTestPageDescriberService,
  createTestSelectionTransformService,
  createTestTranscriptEnrichmentService,
  createTestTranscriptionService,
  type TestAssetDescriberService,
  type TestPageDescriberService,
  type TestTranscriptionService,
  createTestLanguageModelService,
  type TestAiKeyValidationService,
  type TestLanguageModelService,
} from './ai.ts'
import { createTestAudioRecorderService, type TestAudioRecorderService } from './audio-recorder.ts'
import { createTestAgentSkillService, type TestAgentSkillService } from './agent-skill.ts'
import {
  createTestCaptureInboxService,
  createTestWebFetchService,
  createTestXArchiveService,
  type TestCaptureInboxService,
  type TestWebFetchService,
  type TestXArchiveService,
} from './capture.ts'
import {
  createTestGistService,
  createTestGitHostCredentialService,
  createTestGitRepositoryService,
  createTestGithubAuthService,
  createTestGithubRepoService,
  createTestICloudNativeService,
  type TestGitRepositoryService,
  type TestICloudNativeService,
} from './sync.ts'
import { createTestCalendarService, type TestCalendarService } from './calendar.ts'
import { createTestClockService, type TestClockService } from './clock.ts'
import { createTestContactsService, type TestContactsService } from './contacts.ts'
import { createTestChatHistoryService, type TestChatHistoryService } from './chat.ts'
import { createTestDatabaseService, type TestDatabaseService } from './database.ts'
import {
  createTestEmbeddingRuntimeService,
  type TestEmbeddingRuntimeService,
} from './embeddings.ts'
import {
  createTestExceptionTelemetry,
  type TestExceptionTelemetryService,
} from './exception-telemetry.ts'
import { createTestFileChangeService, type TestFileChangeService } from './file-change.ts'
import { createTestAttachmentService, type TestAttachmentService } from './attachments.ts'
import {
  createTestNoteSessionService,
  createTestOpenDocumentsService,
  type TestNoteSessionService,
} from './documents.ts'
import {
  createTestAssetStoreService,
  createTestNoteCreationService,
  createTestNoteFileService,
  createTestNoteLinkResolverService,
  type TestAssetStoreService,
  type TestNoteCreationService,
  type TestNoteFileService,
  type TestNoteLinkResolverService,
} from './graph.ts'
import { createTestGraphSessionService, type TestGraphSessionService } from './graph-session.ts'
import { createTestPrivacyService, type TestPrivacyService } from './privacy.ts'
import { createTestHttpService, type TestHttpService } from './http.ts'
import {
  createTestHashService,
  createTestIdService,
  type TestHashService,
  type TestIdService,
} from './id.ts'
import { createTestImageCodec, type TestImageCodecService } from './image-codec.ts'
import {
  createTestIndexLifecycleService,
  type TestIndexLifecycleService,
} from './index-lifecycle.ts'
import { createTestIndexStoreService, type TestIndexStoreService } from './index-store.ts'
import { createTestIpcBridgeService, type TestIpcBridgeService } from './ipc.ts'
import { createTestLoggerService, type TestLoggerService } from './logger.ts'
import { createTestMobileStorageService, type TestMobileStorageService } from './mobile-storage.ts'
import { createTestOperationsService, type TestOperationsService } from './operations.ts'
import {
  createTestAppStoreEnvironmentService,
  createTestClassicAccessService,
  createTestPaywallService,
  createTestSubscriptionService,
  type TestAppStoreEnvironmentService,
  type TestClassicAccessService,
  type TestPaywallService,
  type TestSubscriptionService,
} from './monetization.ts'
import { createTestPlatformService, type TestPlatformService } from './platform.ts'
import {
  createTestAppStoreService,
  createTestHapticsService,
  createTestIapService,
  createTestWebAuthService,
  type TestAppStoreService,
  type TestHapticsService,
  type TestIapService,
  type TestWebAuthService,
} from './plugins.ts'
import {
  createTestAppInfoService,
  createTestSecretStoreService,
  type TestSecretStoreService,
} from './secrets.ts'
import {
  createTestClipboardService,
  createTestDialogService,
  createTestLifecycleService,
  createTestOpenerService,
  createTestPathService,
  createTestWindowService,
  type TestClipboardService,
  type TestDialogService,
  type TestLifecycleService,
  type TestOpenerService,
  type TestWindowService,
} from './shell.ts'
import { createTestNavigationService, type TestNavigationService } from './navigation.ts'
import { createTestSettingsService, type TestSettingsService } from './settings.ts'
import {
  createTestPersistenceFlushService,
  type TestPersistenceFlushService,
} from './persistence-flush.ts'
import { createTestStorageService, type TestStorageService } from './storage.ts'
import { createTestThemeService, type TestThemeService } from './theme.ts'
import { createTestUpdateService, type TestUpdateService } from './update.ts'
import {
  createTestCommandService,
  createTestKeymapService,
  createTestNativeMenuService,
  type TestNativeMenuService,
} from './commands.ts'
import type { CommandService } from '../commands/command-service.ts'
import type { KeymapService } from '../commands/keymap-service.ts'

/** {@link AppServices} where every service is its in-memory test double. */
export interface TestAppServices extends AppServices {
  readonly ipc: TestIpcBridgeService
  readonly logger: TestLoggerService
  readonly clock: TestClockService
  readonly id: TestIdService
  readonly hash: TestHashService
  readonly platform: TestPlatformService
  readonly storage: TestStorageService
  readonly http: TestHttpService
  readonly dialog: TestDialogService
  readonly clipboard: TestClipboardService
  readonly opener: TestOpenerService
  readonly path: PathService
  readonly window: TestWindowService
  readonly lifecycle: TestLifecycleService
  readonly secretStore: TestSecretStoreService
  readonly appInfo: AppInfoService
  readonly calendar: TestCalendarService
  readonly contacts: TestContactsService
  readonly agentSkill: TestAgentSkillService
  readonly mobileStorage: TestMobileStorageService
  readonly imageCodec: TestImageCodecService
  readonly exceptionTelemetry: TestExceptionTelemetryService
  readonly operations: TestOperationsService
  readonly settings: TestSettingsService
  readonly theme: TestThemeService
  readonly persistenceFlush: TestPersistenceFlushService
  readonly database: TestDatabaseService
  readonly fileChanges: TestFileChangeService
  readonly indexStore: TestIndexStoreService
  readonly embeddingRuntime: TestEmbeddingRuntimeService
  readonly chatHistory: TestChatHistoryService
  readonly update: TestUpdateService
  readonly navigation: TestNavigationService
  readonly gitRepository: TestGitRepositoryService
  readonly icloudNative: TestICloudNativeService
  readonly captureInbox: TestCaptureInboxService
  readonly webFetch: TestWebFetchService
  readonly xArchive: TestXArchiveService
  readonly audioRecorder: TestAudioRecorderService
  readonly haptics: TestHapticsService
  readonly iap: TestIapService
  readonly appStore: TestAppStoreService
  readonly webAuth: TestWebAuthService
  readonly classicAccess: TestClassicAccessService
  readonly subscription: TestSubscriptionService
  readonly appStoreEnvironment: TestAppStoreEnvironmentService
  readonly paywall: TestPaywallService
  readonly noteFile: TestNoteFileService
  readonly assetStore: TestAssetStoreService
  readonly attachments: TestAttachmentService
  readonly noteSessions: TestNoteSessionService
  readonly noteLinkResolver: TestNoteLinkResolverService
  readonly noteCreation: TestNoteCreationService
  readonly privacy: TestPrivacyService
  readonly indexLifecycle: TestIndexLifecycleService
  readonly graphSession: TestGraphSessionService
  readonly aiCredentials: AiCredentialService
  readonly aiKeyValidation: TestAiKeyValidationService
  readonly languageModel: TestLanguageModelService
  readonly aiPrompts: AiPromptService
  readonly keymap: KeymapService
  readonly commands: CommandService
  readonly nativeMenu: TestNativeMenuService
  readonly aiProviderConfig: AiProviderConfigService
  readonly selectionTransform: SelectionTransformService
  readonly pageDescriber: TestPageDescriberService
  readonly assetDescriber: TestAssetDescriberService
  readonly transcription: TestTranscriptionService
  readonly transcriptEnrichment: TranscriptEnrichmentService
}

/** Fresh test doubles for every app service, with `overrides` in place of the matching ones. */
export function createTestAppServices(): TestAppServices
export function createTestAppServices<Overrides extends Partial<AppServices>>(
  overrides: Overrides,
): Omit<TestAppServices, keyof Overrides> & Overrides
export function createTestAppServices(overrides?: Partial<AppServices>): AppServices {
  const testLogger = createTestLoggerService()
  const logger = overrides?.logger ?? testLogger
  const clock = createTestClockService()
  const operations = createTestOperationsService(clock)
  const database = createTestDatabaseService()
  const noteFile = createTestNoteFileService()
  const id = createTestIdService()
  const secretStore = createTestSecretStoreService()
  const settings = createTestSettingsService(
    {},
    { operations: overrides?.operations ?? operations },
  )
  const indexReads = createIndexReadServices({
    database: overrides?.database ?? database,
    noteFile: overrides?.noteFile ?? noteFile,
  })
  const noteLinkResolver = createTestNoteLinkResolverService({
    wikiResolver: overrides?.wikiResolver ?? indexReads.wikiResolver,
    noteFile: overrides?.noteFile ?? noteFile,
  })
  const http = createTestHttpService()
  const fileChanges = createTestFileChangeService()
  const indexStore = createTestIndexStoreService()
  const xArchive = createTestXArchiveService()
  const hash = createTestHashService()
  const aiCredentials = createTestAiCredentialService({
    secretStore: overrides?.secretStore ?? secretStore,
  })
  const aiKeyValidation = createTestAiKeyValidationService()
  const languageModel = createTestLanguageModelService()
  const privacy = createTestPrivacyService({ noteFile: overrides?.noteFile ?? noteFile })
  const aiProviderConfig = createTestAiProviderConfigService({
    settings: overrides?.settings ?? settings,
    credentials: overrides?.aiCredentials ?? aiCredentials,
    keyValidation: overrides?.aiKeyValidation ?? aiKeyValidation,
    id: overrides?.id ?? id,
  })
  const platform = createTestPlatformService()
  const commands = createTestCommandService({
    platform: overrides?.platform ?? platform,
    logger,
  })
  const dialog = createTestDialogService()
  const path = createTestPathService()
  const windowService = createTestWindowService()
  const lifecycle = createTestLifecycleService()
  const mobileStorage = createTestMobileStorageService()
  const indexLifecycle = createTestIndexLifecycleService({
    indexStore: overrides?.indexStore ?? indexStore,
    noteFile: overrides?.noteFile ?? noteFile,
    fileChanges: overrides?.fileChanges ?? fileChanges,
    database: overrides?.database ?? database,
    xArchive: overrides?.xArchive ?? xArchive,
    hash: overrides?.hash ?? hash,
    clock: overrides?.clock ?? clock,
    logger,
    operations: overrides?.operations ?? operations,
  })
  const services: TestAppServices = {
    ipc: createTestIpcBridgeService({ logger }),
    logger: testLogger,
    clock,
    id,
    hash,
    platform,
    storage: createTestStorageService(),
    http,
    dialog,
    clipboard: createTestClipboardService(),
    opener: createTestOpenerService({ logger }),
    path,
    window: windowService,
    lifecycle,
    secretStore,
    appInfo: createTestAppInfoService(),
    calendar: createTestCalendarService(),
    contacts: createTestContactsService(),
    agentSkill: createTestAgentSkillService(),
    mobileStorage,
    imageCodec: createTestImageCodec(),
    exceptionTelemetry: createTestExceptionTelemetry(),
    operations,
    settings,
    theme: createTestThemeService(),
    persistenceFlush: createTestPersistenceFlushService(),
    database,
    fileChanges,
    indexStore,
    embeddingRuntime: createTestEmbeddingRuntimeService(),
    chatHistory: createTestChatHistoryService(),
    update: createTestUpdateService(),
    navigation: createTestNavigationService(),
    gitRepository: createTestGitRepositoryService(),
    githubAuth: createTestGithubAuthService({
      secretStore: overrides?.secretStore ?? secretStore,
      http: overrides?.http ?? http,
      clock: overrides?.clock ?? clock,
    }),
    gitHostCredentials: createTestGitHostCredentialService({
      secretStore: overrides?.secretStore ?? secretStore,
    }),
    githubRepos: createTestGithubRepoService({ http: overrides?.http ?? http }),
    gists: createTestGistService({ http: overrides?.http ?? http }),
    icloudNative: createTestICloudNativeService(),
    captureInbox: createTestCaptureInboxService(),
    webFetch: createTestWebFetchService(),
    xArchive,
    audioRecorder: createTestAudioRecorderService(),
    haptics: createTestHapticsService(),
    iap: createTestIapService(),
    appStore: createTestAppStoreService(),
    webAuth: createTestWebAuthService(null),
    classicAccess: createTestClassicAccessService(),
    subscription: createTestSubscriptionService(),
    appStoreEnvironment: createTestAppStoreEnvironmentService(),
    paywall: createTestPaywallService(),
    noteFile,
    assetStore: createTestAssetStoreService(),
    attachments: createTestAttachmentService(),
    noteSessions: createTestNoteSessionService({
      noteFile: overrides?.noteFile ?? noteFile,
      clock: overrides?.clock ?? clock,
      logger,
    }),
    openDocuments: createTestOpenDocumentsService(),
    ...indexReads,
    noteLinkResolver,
    noteCreation: createTestNoteCreationService({
      noteFile: overrides?.noteFile ?? noteFile,
      noteLinkResolver: overrides?.noteLinkResolver ?? noteLinkResolver,
      id: overrides?.id ?? id,
    }),
    privacy,
    indexLifecycle,
    graphSession: createTestGraphSessionService({
      ...(overrides?.ipc === undefined ? {} : { ipc: overrides.ipc }),
      indexLifecycle: overrides?.indexLifecycle ?? indexLifecycle,
      indexStore: overrides?.indexStore ?? indexStore,
      noteFile: overrides?.noteFile ?? noteFile,
      id: overrides?.id ?? id,
      fileChanges: overrides?.fileChanges ?? fileChanges,
      window: overrides?.window ?? windowService,
      dialog: overrides?.dialog ?? dialog,
      path: overrides?.path ?? path,
      platform: overrides?.platform ?? platform,
      lifecycle: overrides?.lifecycle ?? lifecycle,
      mobileStorage: overrides?.mobileStorage ?? mobileStorage,
      logger,
    }),
    aiCredentials,
    aiKeyValidation,
    languageModel,
    aiPrompts: createTestAiPromptService({
      settings: overrides?.settings ?? settings,
      id: overrides?.id ?? id,
    }),
    keymap: createTestKeymapService({ platform: overrides?.platform ?? platform }),
    commands,
    nativeMenu: createTestNativeMenuService({
      commands: overrides?.commands ?? commands,
      window: overrides?.window ?? windowService,
      platform: overrides?.platform ?? platform,
      logger,
    }),
    aiProviderConfig,
    selectionTransform: createTestSelectionTransformService({
      languageModel: overrides?.languageModel ?? languageModel,
      providerConfig: overrides?.aiProviderConfig ?? aiProviderConfig,
      credentials: overrides?.aiCredentials ?? aiCredentials,
      privacy: overrides?.privacy ?? privacy,
    }),
    pageDescriber: createTestPageDescriberService(),
    assetDescriber: createTestAssetDescriberService(),
    transcription: createTestTranscriptionService(),
    transcriptEnrichment: createTestTranscriptEnrichmentService({
      languageModel: overrides?.languageModel ?? languageModel,
    }),
  }
  return Object.assign(services, overrides)
}

export interface TestGraphServices<
  App extends AppServices = TestAppServices,
> extends GraphServices {
  readonly app: App
}

/**
 * {@link GraphServices} over `app` (fresh test doubles by default) and a
 * session at `/graphs/test` with generation 1, patched by `sessionOverrides`.
 * The role defaults to `main`.
 */
export function createTestGraphServices(
  app?: undefined,
  sessionOverrides?: Partial<GraphSession>,
  role?: GraphRole,
): TestGraphServices
export function createTestGraphServices<App extends AppServices>(
  app: App,
  sessionOverrides?: Partial<GraphSession>,
  role?: GraphRole,
): TestGraphServices<App>
export function createTestGraphServices(
  app?: AppServices,
  sessionOverrides?: Partial<GraphSession>,
  role?: GraphRole,
): TestGraphServices<AppServices> {
  const session = createGraphSession(
    {
      root: sessionOverrides?.root ?? '/graphs/test',
      name: sessionOverrides?.name ?? 'test',
      generation: sessionOverrides?.generation ?? 1,
      indexGeneration: sessionOverrides?.indexGeneration ?? 1,
    },
    sessionOverrides?.signal,
  )
  return createGraphServices(app ?? createTestAppServices(), session, role ?? 'main')
}

/**
 * Point every process-wide `defaultXxx()` at `services`. The returned
 * function resets every default to its state before any install.
 */
export function installTestServices(services: AppServices): () => void {
  installDefaultServices(services)
  return resetDefaultServices
}
