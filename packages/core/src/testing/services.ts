import type { GraphSessionSource } from '../app/graph-session.ts'
import {
  composeCoreServices,
  createIndexReadServices,
  type CoreAdapters,
  type CoreServices,
  type CoreInternalServices,
  type MobileServices,
  type NoteServices,
  type ServiceFactories,
} from '../app/create-core-services.ts'
import { createGraphServices } from '../app/create-graph-services.ts'
import { createDetachedLifecycleDom } from '../app/lifecycle-service.ts'
import { createPosixPathTransport } from '../app/path-service.ts'
import { createSingleWindowHost } from '../app/window-service.ts'
import { createPrivacyService } from '../privacy/privacy-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { ProgressPort } from '../app/ports.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { WikiResolverService } from '../indexing/wiki-resolver-service.ts'
import type { BackupService } from '../sync/backup-service.ts'
import {
  createTestAiKeyValidationService,
  createTestAssetDescriberService,
  createTestLanguageModelService,
  createTestPageDescriberService,
  createTestTranscriptionService,
} from './ai.ts'
import { createTestAgentSkillService } from './agent-skill.ts'
import { createTestAssetDescriptionService } from './assets.ts'
import { createTestAttachmentService } from './attachments.ts'
import { createTestAudioRecorderService } from './audio-recorder.ts'
import { createTestCalendarService } from './calendar.ts'
import {
  createTestCaptureInboxService,
  createTestCaptureService,
  createTestWebFetchService,
  createTestXArchiveService,
} from './capture.ts'
import {
  createTestChatEngineService,
  createTestChatGraphContextService,
  createTestChatHistoryService,
} from './chat.ts'
import { createTestClockService } from './clock.ts'
import { createTestContactsService } from './contacts.ts'
import { createTestDatabaseService } from './database.ts'
import { createTestDeepLinkIntakeService } from './deep-link.ts'
import { createTestNoteMoveService } from './documents.ts'
import {
  createTestEmbeddingIndexService,
  createTestEmbeddingRuntimeService,
  createTestRetrievalService,
  createTestSemanticSearchService,
} from './embeddings.ts'
import { createTestFileChangeService } from './file-change.ts'
import {
  createTestAssetStoreService,
  createTestNoteCreationService,
  createTestNoteFileService,
  createTestNoteLinkResolverService,
} from './graph.ts'
import { createTestGraphSessionService } from './graph-session.ts'
import { createTestHttpService } from './http.ts'
import { createTestHashService, createTestIdService } from './id.ts'
import { createTestImageCodec } from './image-codec.ts'
import { createTestIndexLifecycleService } from './index-lifecycle.ts'
import { createTestIndexStoreService } from './index-store.ts'
import { createTestIpcBridgeService, type TestIpcBridgeService } from './ipc.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestMobileOnboardingService } from './mobile-onboarding.ts'
import { createTestMobileStorageService } from './mobile-storage.ts'
import {
  createTestAppStoreEnvironmentService,
  createTestClassicAccessService,
  createTestPaywallService,
  createTestSubscriptionService,
} from './monetization.ts'
import { createTestPersistenceFlushService } from './persistence-flush.ts'
import { createTestPlatformService, type TestPlatformService } from './platform.ts'
import { createTestProgressPort } from './ports.ts'
import {
  createTestAppStoreService,
  createTestHapticsService,
  createTestIapService,
  createTestWebAuthService,
} from './plugins.ts'
import { createTestAppInfoService, createTestSecretStoreService } from './secrets.ts'
import { createTestSettingsService } from './settings.ts'
import {
  createTestDialogService,
  createTestLifecycleService,
  createTestWindowService,
} from './shell.ts'
import { createTestStorageService } from './storage.ts'
import {
  createTestGitRepositoryService,
  createTestGithubAuthService,
  createTestICloudNativeService,
} from './sync.ts'

/**
 * Replacements for the services of {@link createTestCoreServices}.
 */
export type TestCoreServiceOverrides = Partial<CoreServices & CoreInternalServices> & {
  /**
   * The backup service of every main-window graph session.
   */
  readonly backup?: BackupService
  /**
   * The progress port the services report to.
   */
  readonly progress?: ProgressPort
}

/**
 * The services that {@link createTestCoreServices} passes as adapters.
 */
function createTestEdgeServices() {
  return {
    logger: createTestLoggerService(),
    clock: createTestClockService(),
    id: createTestIdService(),
    hash: createTestHashService(),
    http: createTestHttpService(),
    dialog: createTestDialogService(),
    imageCodec: createTestImageCodec(),
    progress: createTestProgressPort(),
  }
}

type TestEdgeServices = ReturnType<typeof createTestEdgeServices>

/**
 * {@link createNoteServices} with doubles that record each resolution and creation.
 */
function createTestNoteServices(deps: {
  noteFile: NoteFileService
  wikiResolver: WikiResolverService
  id: IdService
  graphSession: GraphSessionSource
}) {
  const noteLinkResolver = createTestNoteLinkResolverService(deps)
  return {
    noteLinkResolver,
    noteCreation: createTestNoteCreationService({ ...deps, noteLinkResolver }),
    privacy: createPrivacyService(deps),
  } satisfies NoteServices
}

/**
 * The services whose test double is not the real service: in-memory, scripted, or recording.
 */
function createTestServiceFactories(
  shared: { ipc: TestIpcBridgeService; platform: TestPlatformService },
  overrides: TestCoreServiceOverrides | undefined,
) {
  /**
   * Puts the overrides of a group's members in place of the built ones.
   */
  function withOverrides<Group extends object>(group: Group): Group {
    const result = { ...group } as Record<string, unknown>
    for (const key of Object.keys(group)) {
      const service = overrides?.[key as keyof TestCoreServiceOverrides]
      if (service !== undefined) {
        result[key] = service
      }
    }
    return result as Group
  }

  const backup = overrides?.backup
  return {
    ipc: () => shared.ipc,
    database: () => createTestDatabaseService(),
    platform: () => shared.platform,
    window: () => createTestWindowService(),
    settings: ({ progress }) => createTestSettingsService({}, { progress }),
    storage: () => createTestStorageService(),
    lifecycle: () => createTestLifecycleService(),
    fileChanges: () => createTestFileChangeService(),
    secretStore: () => createTestSecretStoreService(),
    webAuth: () => createTestWebAuthService(null),
    classicAccess: () => createTestClassicAccessService(),
    audioRecorder: () => createTestAudioRecorderService(),
    iap: () => createTestIapService(),
    appStore: () => createTestAppStoreService(),
    subscription: () => createTestSubscriptionService(),
    appStoreEnvironment: () => createTestAppStoreEnvironmentService(),
    haptics: () => createTestHapticsService(),
    paywall: () => createTestPaywallService(),
    mobile: ({ build }) => build(),
    noteFile: () => createTestNoteFileService(),
    assetStore: () => createTestAssetStoreService(),
    indexReads: (deps) => withOverrides(createIndexReadServices(deps)),
    indexStore: () => createTestIndexStoreService(),
    xArchive: () => createTestXArchiveService(),
    aiKeyValidation: () => createTestAiKeyValidationService(),
    languageModel: () => createTestLanguageModelService(),
    noteServices: (deps) => withOverrides(createTestNoteServices(deps)),
    calendar: () => createTestCalendarService(),
    contacts: () => createTestContactsService(),
    mobileStorage: () => createTestMobileStorageService(),
    noteMove: (deps) => createTestNoteMoveService(deps),
    captureInbox: () => createTestCaptureInboxService(),
    deepLinkIntake: (deps) => createTestDeepLinkIntakeService(deps),
    webFetch: () => createTestWebFetchService(),
    pageDescriber: () => createTestPageDescriberService(),
    assetDescriber: () => createTestAssetDescriberService(),
    indexLifecycle: (deps) => createTestIndexLifecycleService(deps),
    // The test graph session answers the graph commands on its own bridge unless a test gives one.
    graphSession: ({ ipc: _ipc, ...deps }) =>
      createTestGraphSessionService(
        overrides?.ipc === undefined ? deps : { ...deps, ipc: overrides.ipc },
      ),
    attachments: ({ graphSession }) => createTestAttachmentService({ graphSession }),
    persistenceFlush: ({ openDocuments }) => createTestPersistenceFlushService({ openDocuments }),
    gitRepository: () => createTestGitRepositoryService(),
    githubAuth: (deps) => createTestGithubAuthService(deps),
    icloudNative: () => createTestICloudNativeService(),
    embeddingRuntime: () => createTestEmbeddingRuntimeService(),
    retrieval: () => createTestRetrievalService(),
    embeddingIndex: (deps) => createTestEmbeddingIndexService(deps),
    transcription: () => createTestTranscriptionService(),
    chatHistory: () => createTestChatHistoryService(),
    chatEngine: () => createTestChatEngineService(),
    chatGraphContext: () => createTestChatGraphContextService(),
    appInfo: () => createTestAppInfoService(),
    agentSkill: () => createTestAgentSkillService(),
    semanticSearch: (deps) => createTestSemanticSearchService(deps),
    mobileOnboarding: (deps) => createTestMobileOnboardingService(deps),
    capture: () => createTestCaptureService(),
    assetDescription: () => createTestAssetDescriptionService(),
    graphServices: (session, role, deps) =>
      createGraphServices(
        session,
        role,
        deps,
        backup === undefined ? {} : { backup: () => backup },
      ),
  } satisfies Partial<ServiceFactories>
}

type TestServiceFactories = ReturnType<typeof createTestServiceFactories>

/**
 * The service each factory builds.
 */
type Built<Factories> = {
  readonly [Key in keyof Factories]: Factories[Key] extends (...args: never) => infer Service
    ? Service
    : never
}

/**
 * `Base` with the members of `Narrow` in place of its own.
 */
type Override<Base, Narrow> = Omit<Base, keyof Narrow> & Narrow

type MobileKey = 'iap' | 'appStore' | 'subscription' | 'appStoreEnvironment' | 'haptics' | 'paywall'

/**
 * {@link MobileServices} where each service with a test double is that double.
 */
export type TestMobileServices = Override<
  MobileServices,
  Pick<Built<TestServiceFactories>, 'haptics' | 'subscription' | 'appStoreEnvironment' | 'paywall'>
>

/**
 * {@link CoreServices} plus {@link CoreInternalServices}, where each service with
 * a test double is that double. The mobile services always exist.
 */
export type TestCoreServices = Override<
  CoreServices & CoreInternalServices,
  Omit<Built<TestServiceFactories>, MobileKey | 'mobile' | 'indexReads' | 'noteServices'> &
    Built<TestServiceFactories>['noteServices'] &
    TestEdgeServices & { readonly mobile: TestMobileServices }
>

/**
 * {@link createCoreServices} over test adapters, with the test double of each
 * service that has one and `overrides` in place of the matching services.
 */
export function createTestCoreServices<
  Overrides extends TestCoreServiceOverrides = Record<never, never>,
>(
  overrides?: Overrides & TestCoreServiceOverrides,
): Omit<TestCoreServices, keyof Overrides> & Omit<Overrides, 'backup'> {
  const defaults = createTestEdgeServices()
  const edge = { ...defaults, ...overrides }
  const ipc = createTestIpcBridgeService({ logger: edge.logger })
  const platform = createTestPlatformService()
  const adapters: CoreAdapters = {
    ipc: ipc.transport,
    platform: edge.platform ?? platform,
    progress: edge.progress,
    http: edge.http,
    storage: { local: null, session: null },
    dialog: edge.dialog,
    path: createPosixPathTransport('/home/test'),
    window: createSingleWindowHost(),
    lifecycle: createDetachedLifecycleDom(),
    logger: edge.logger,
    clock: edge.clock,
    id: edge.id,
    hash: edge.hash,
    imageCodec: edge.imageCodec,
  }
  const fixed: Record<string, () => unknown> = {}
  for (const [key, service] of Object.entries(overrides ?? {})) {
    if (key !== 'backup' && key !== 'progress') {
      fixed[key] = () => service
    }
  }
  const { services, internal } = composeCoreServices(adapters, {
    ...createTestServiceFactories({ ipc, platform }, overrides),
    ...(fixed as Partial<ServiceFactories>),
  })
  return { ...services, ...internal, progress: edge.progress } as Omit<
    TestCoreServices,
    keyof Overrides
  > &
    Omit<Overrides, 'backup'>
}
