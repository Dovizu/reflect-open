import type { AiCredentialService } from '../ai/ai-credential-service.ts'
import type { AiProviderConfigService } from '../ai/ai-provider-config-service.ts'
import type { TranscriptEnrichmentService } from '../ai/transcript-enrichment-service.ts'
import type { TranscriptionService } from '../ai/transcription-service.ts'
import {
  createBackgroundReconcilerFactory,
  type BackgroundReconcilerFactory,
} from '../app/background-reconciler.ts'
import type { ClockService } from '../app/clock-service.ts'
import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { PlatformFacts } from '../app/platform-service.ts'
import type { WindowService } from '../app/window-service.ts'
import { createAudioMemoService, type AudioMemoService } from '../audio/audio-memo-service.ts'
import type { AudioRecorderService } from '../audio/audio-recorder-service.ts'
import {
  createMobileAudioMemoService,
  type MobileAudioMemoService,
} from '../audio/mobile-audio-memo-service.ts'
import {
  createNativeActionService,
  type NativeActionService,
} from '../audio/native-action-service.ts'
import type { BacklinkTargetService } from '../capture/backlink-target-service.ts'
import type { AssetStoreService } from '../graph/asset-store-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { FileChangeService } from '../indexing/file-change-service.ts'
import type { HapticsService } from '../ipc/mobile-haptics-plugin.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import {
  createTestAiCredentialService,
  createTestAiProviderConfigService,
  createTestTranscriptEnrichmentService,
  createTestTranscriptionService,
} from './ai.ts'
import { createTestAudioRecorderService } from './audio-recorder.ts'
import { createTestBacklinkTargetService } from './capture.ts'
import { createTestClockService } from './clock.ts'
import { createTestFileChangeService } from './file-change.ts'
import { createTestAssetStoreService, createTestNoteFileService } from './graph.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'
import { createTestPlatformService } from './platform.ts'
import { createTestHapticsService } from './plugins.ts'
import { createTestSettingsService } from './settings.ts'
import { createTestLifecycleService, createTestWindowService } from './shell.ts'

/** The services an audio memo service runs on; each defaults to its test service. */
export interface TestAudioMemoServiceOptions {
  assetStore?: AssetStoreService
  noteFile?: NoteFileService
  /** Defaults to the real service over `noteFile`. */
  backlinkTarget?: BacklinkTargetService
  transcription?: TranscriptionService
  transcriptEnrichment?: TranscriptEnrichmentService
  /** Defaults to the real service over `settings` and `aiCredentials`. */
  aiProviderConfig?: AiProviderConfigService
  aiCredentials?: AiCredentialService
  audioRecorder?: AudioRecorderService
  /** Defaults to the real factory over `lifecycle`. */
  reconcilers?: BackgroundReconcilerFactory
  lifecycle?: AppLifecycleService
  fileChanges?: FileChangeService
  settings?: SettingsService
  operations?: OperationsService
  clock?: ClockService
  platform?: PlatformFacts
  window?: WindowService
  logger?: LoggerService
}

/** The real {@link AudioMemoService} over test services. */
export function createTestAudioMemoService(
  options?: TestAudioMemoServiceOptions,
): AudioMemoService {
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  const settings = options?.settings ?? createTestSettingsService()
  const aiCredentials = options?.aiCredentials ?? createTestAiCredentialService()
  const lifecycle = options?.lifecycle ?? createTestLifecycleService()
  return createAudioMemoService({
    assetStore: options?.assetStore ?? createTestAssetStoreService(),
    noteFile,
    backlinkTarget: options?.backlinkTarget ?? createTestBacklinkTargetService({ noteFile }),
    transcription: options?.transcription ?? createTestTranscriptionService(),
    transcriptEnrichment: options?.transcriptEnrichment ?? createTestTranscriptEnrichmentService(),
    aiProviderConfig:
      options?.aiProviderConfig ??
      createTestAiProviderConfigService({ settings, credentials: aiCredentials }),
    aiCredentials,
    audioRecorder: options?.audioRecorder ?? createTestAudioRecorderService(),
    reconcilers: options?.reconcilers ?? createBackgroundReconcilerFactory({ lifecycle }),
    lifecycle,
    fileChanges: options?.fileChanges ?? createTestFileChangeService(),
    settings,
    operations: options?.operations ?? createTestOperationsService(),
    clock: options?.clock ?? createTestClockService(),
    platform: options?.platform ?? createTestPlatformService(),
    window: options?.window ?? createTestWindowService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}

/** The services a native action service runs on; each defaults to its test service. */
export interface TestNativeActionServiceOptions {
  audioRecorder?: AudioRecorderService
  clock?: ClockService
  platform?: PlatformFacts
  logger?: LoggerService
}

/** The real {@link NativeActionService} over test services. */
export function createTestNativeActionService(
  options?: TestNativeActionServiceOptions,
): NativeActionService {
  return createNativeActionService({
    audioRecorder: options?.audioRecorder ?? createTestAudioRecorderService(),
    clock: options?.clock ?? createTestClockService(),
    platform: options?.platform ?? createTestPlatformService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}

/** The services a mobile audio memo service runs on; each defaults to its test service. */
export interface TestMobileAudioMemoServiceOptions {
  /** Defaults to the real service over `audioRecorder`, `lifecycle`, `platform` and `logger`. */
  audioMemo?: AudioMemoService
  audioRecorder?: AudioRecorderService
  /** Defaults to the real service over `audioRecorder`, `platform` and `logger`. */
  nativeAction?: NativeActionService
  lifecycle?: AppLifecycleService
  haptics?: HapticsService
  platform?: PlatformFacts
  logger?: LoggerService
}

/** The real {@link MobileAudioMemoService} over test services. */
export function createTestMobileAudioMemoService(
  options?: TestMobileAudioMemoServiceOptions,
): MobileAudioMemoService {
  const audioRecorder = options?.audioRecorder ?? createTestAudioRecorderService()
  const lifecycle = options?.lifecycle ?? createTestLifecycleService()
  const platform = options?.platform ?? createTestPlatformService()
  const logger = options?.logger ?? createTestLoggerService()
  return createMobileAudioMemoService({
    audioMemo:
      options?.audioMemo ??
      createTestAudioMemoService({ audioRecorder, lifecycle, platform, logger }),
    audioRecorder,
    nativeAction:
      options?.nativeAction ?? createTestNativeActionService({ audioRecorder, platform, logger }),
    lifecycle,
    haptics: options?.haptics ?? createTestHapticsService(),
    platform,
    logger,
  })
}
