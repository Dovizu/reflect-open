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
  createTestGitRepositoryService,
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
import {
  createTestAssetStoreService,
  createTestNoteFileService,
  type TestAssetStoreService,
  type TestNoteFileService,
} from './graph.ts'
import { createTestHttpService, type TestHttpService } from './http.ts'
import {
  createTestHashService,
  createTestIdService,
  type TestHashService,
  type TestIdService,
} from './id.ts'
import { createTestImageCodec, type TestImageCodecService } from './image-codec.ts'
import { createTestIndexStoreService, type TestIndexStoreService } from './index-store.ts'
import { createTestIpcBridgeService, type TestIpcBridgeService } from './ipc.ts'
import { createTestLoggerService, type TestLoggerService } from './logger.ts'
import { createTestMobileStorageService, type TestMobileStorageService } from './mobile-storage.ts'
import { createTestOperationsService, type TestOperationsService } from './operations.ts'
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
import { createTestSettingsService, type TestSettingsService } from './settings.ts'
import {
  createTestPersistenceFlushService,
  type TestPersistenceFlushService,
} from './persistence-flush.ts'
import { createTestStorageService, type TestStorageService } from './storage.ts'
import { createTestUpdateService, type TestUpdateService } from './update.ts'

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
  readonly persistenceFlush: TestPersistenceFlushService
  readonly database: TestDatabaseService
  readonly fileChanges: TestFileChangeService
  readonly indexStore: TestIndexStoreService
  readonly embeddingRuntime: TestEmbeddingRuntimeService
  readonly chatHistory: TestChatHistoryService
  readonly update: TestUpdateService
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
  readonly noteFile: TestNoteFileService
  readonly assetStore: TestAssetStoreService
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
  const services: TestAppServices = {
    ipc: createTestIpcBridgeService({ logger }),
    logger: testLogger,
    clock,
    id: createTestIdService(),
    hash: createTestHashService(),
    platform: createTestPlatformService(),
    storage: createTestStorageService(),
    http: createTestHttpService(),
    dialog: createTestDialogService(),
    clipboard: createTestClipboardService(),
    opener: createTestOpenerService({ logger }),
    path: createTestPathService(),
    window: createTestWindowService(),
    lifecycle: createTestLifecycleService(),
    secretStore: createTestSecretStoreService(),
    appInfo: createTestAppInfoService(),
    calendar: createTestCalendarService(),
    contacts: createTestContactsService(),
    agentSkill: createTestAgentSkillService(),
    mobileStorage: createTestMobileStorageService(),
    imageCodec: createTestImageCodec(),
    exceptionTelemetry: createTestExceptionTelemetry(),
    operations,
    settings: createTestSettingsService({}, { operations: overrides?.operations ?? operations }),
    persistenceFlush: createTestPersistenceFlushService(),
    database,
    fileChanges: createTestFileChangeService(),
    indexStore: createTestIndexStoreService(),
    embeddingRuntime: createTestEmbeddingRuntimeService(),
    chatHistory: createTestChatHistoryService(),
    update: createTestUpdateService(),
    gitRepository: createTestGitRepositoryService(),
    icloudNative: createTestICloudNativeService(),
    captureInbox: createTestCaptureInboxService(),
    webFetch: createTestWebFetchService(),
    xArchive: createTestXArchiveService(),
    audioRecorder: createTestAudioRecorderService(),
    haptics: createTestHapticsService(),
    iap: createTestIapService(),
    appStore: createTestAppStoreService(),
    webAuth: createTestWebAuthService(null),
    noteFile,
    assetStore: createTestAssetStoreService(),
    ...createIndexReadServices({
      database: overrides?.database ?? database,
      noteFile: overrides?.noteFile ?? noteFile,
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
