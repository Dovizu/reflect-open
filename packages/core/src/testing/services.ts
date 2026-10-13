import type { GraphRole, GraphSession, GraphSessionSource } from '../app/graph-session.ts'
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
import {
  createGraphServices,
  type GraphLifecycleFlags,
  type GraphServices,
  type GraphServicesDeps,
} from '../app/create-graph-services.ts'
import { createPosixPathTransport } from '../app/path-service.ts'
import { isMobilePlatform } from '../app/platform.ts'
import type { PlatformFacts } from '../app/platform-service.ts'
import { isICloudRoot } from '../sync/icloud-sync-service.ts'
import { createPrivacyService } from '../privacy/privacy-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { ActivityPort, ProgressPort } from '../app/ports.ts'
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
import { createTestActivityPort } from './shell.ts'
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
   * The activity signals the services follow.
   */
  readonly activity?: ActivityPort
  /**
   * The progress port the services report to.
   */
  readonly progress?: ProgressPort
  /**
   * Which window the services run in; defaults to the main window.
   */
  readonly role?: GraphRole
  /**
   * Builds the graph-scoped services of each session; defaults to
   * {@link createGraphServices} with the lifecycles of {@link testGraphLifecycles}.
   */
  readonly createGraphServices?: (session: GraphSession, deps: GraphServicesDeps) => GraphServices
}

/**
 * The lifecycles a test session runs: the main window runs the backup, the
 * capture drain, the iCloud conflict sweeps of an iCloud root and, off
 * mobile, the asset descriptions. No session refreshes iCloud downloads.
 */
function testGraphLifecycles(session: GraphSession, platform: PlatformFacts): GraphLifecycleFlags {
  const main = session.role === 'main'
  const mobile = isMobilePlatform(platform.appPlatform) || platform.surface.mobileApp
  return {
    backup: main,
    icloudSync: main && isICloudRoot(session.root),
    capture: main,
    assetDescription: main && !mobile,
    icloudDownload: false,
    metadataWatch: platform.surface.mobileApp,
  }
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
    imageCodec: createTestImageCodec(),
    activity: createTestActivityPort(),
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
function createTestServiceFactories(overrides: TestCoreServiceOverrides | undefined) {
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

  return {
    database: () => createTestDatabaseService(),
    settings: ({ progress }) => createTestSettingsService({}, { progress }),
    storage: () => createTestStorageService(),
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
    capture: () => createTestCaptureService(),
    assetDescription: () => createTestAssetDescriptionService(),
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
    TestEdgeServices & {
      readonly ipc: TestIpcBridgeService
      readonly mobile: TestMobileServices
      readonly platform: TestPlatformService
      readonly role: GraphRole
    }
>

/**
 * The overrides that go to the adapters rather than in place of a service.
 */
const TEST_ADAPTER_KEYS = new Set(['backup', 'progress', 'role', 'createGraphServices'])

type TestAdapterKey = 'backup' | 'createGraphServices'

/**
 * {@link createCoreServices} over test adapters, with the test double of each
 * service that has one and `overrides` in place of the matching services.
 */
export function createTestCoreServices<
  Overrides extends TestCoreServiceOverrides = Record<never, never>,
>(
  overrides?: Overrides & TestCoreServiceOverrides,
): Omit<TestCoreServices, keyof Overrides> & Omit<Overrides, TestAdapterKey> {
  const defaults = createTestEdgeServices()
  const edge = { ...defaults, ...overrides }
  const platform = edge.platform ?? createTestPlatformService()
  const backup = overrides?.backup
  const adapters: CoreAdapters = {
    ipc: edge.ipc ?? createTestIpcBridgeService({ logger: edge.logger }),
    platform,
    role: edge.role ?? 'main',
    progress: edge.progress,
    http: edge.http,
    storage: { local: null, session: null },
    path: createPosixPathTransport('/home/test'),
    activity: edge.activity,
    logger: edge.logger,
    clock: edge.clock,
    id: edge.id,
    hash: edge.hash,
    imageCodec: edge.imageCodec,
    createGraphServices:
      edge.createGraphServices ??
      ((session, deps) =>
        createGraphServices(
          session,
          deps,
          testGraphLifecycles(session, platform),
          backup === undefined ? {} : { backup: () => backup },
        )),
  }
  const fixed: Record<string, () => unknown> = {}
  for (const [key, service] of Object.entries(overrides ?? {})) {
    if (!TEST_ADAPTER_KEYS.has(key)) {
      fixed[key] = () => service
    }
  }
  const { services, internal } = composeCoreServices(adapters, {
    ...createTestServiceFactories(overrides),
    ...(fixed as Partial<ServiceFactories>),
  })
  return {
    ...services,
    ...internal,
    activity: adapters.activity,
    progress: edge.progress,
    role: adapters.role,
  } as Omit<TestCoreServices, keyof Overrides> & Omit<Overrides, TestAdapterKey>
}
