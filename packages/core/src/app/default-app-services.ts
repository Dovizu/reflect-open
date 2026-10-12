import type { AppServices } from './create-app-services.ts'
import { defaultAiCredentials } from '../ai/ai-credential-service.ts'
import { defaultAiKeyValidation } from '../ai/ai-key-validation-service.ts'
import { defaultAiPrompts } from '../ai/ai-prompt-service.ts'
import { defaultAiProviderConfig } from '../ai/ai-provider-config-service.ts'
import { defaultAssetDescriber } from '../ai/asset-describer-service.ts'
import { defaultChatHistory } from '../ai/chat/chat-history-service.ts'
import { defaultLanguageModel } from '../ai/language-model-service.ts'
import { defaultPageDescriber } from '../ai/page-describer-service.ts'
import { defaultSelectionTransform } from '../ai/selection-transform-service.ts'
import { defaultTranscriptEnrichment } from '../ai/transcript-enrichment-service.ts'
import { defaultTranscription } from '../ai/transcription-service.ts'
import { defaultAssetDescription } from '../assets/asset-description-service.ts'
import { defaultAssetPrivacy } from '../assets/asset-privacy-service.ts'
import { defaultAudioMemo } from '../audio/audio-memo-service.ts'
import { defaultAudioRecorder } from '../audio/default-audio-recorder.ts'
import { defaultMobileAudioMemo } from '../audio/mobile-audio-memo-service.ts'
import { defaultNativeAction } from '../audio/native-action-service.ts'
import { defaultCalendarEvents } from '../calendar/calendar-events-service.ts'
import { defaultCalendar } from '../calendar/calendar-service.ts'
import { defaultBacklinkTarget } from '../capture/backlink-target-service.ts'
import { defaultCapture } from '../capture/capture-service.ts'
import { defaultClassicAccess } from '../classic/classic-access-service.ts'
import { defaultCommands } from '../commands/command-service.ts'
import { defaultKeymap } from '../commands/keymap-service.ts'
import { defaultNativeMenu } from '../commands/native-menu-service.ts'
import { defaultContactSuggestions } from '../contacts/contact-suggestion-service.ts'
import { defaultContacts } from '../contacts/contacts-service.ts'
import { defaultMeetings } from '../contacts/meeting-service.ts'
import { defaultPersonNotes } from '../contacts/person-note-service.ts'
import { defaultDailyNotes } from '../daily/daily-note-service.ts'
import { defaultAttachments } from '../documents/attachment-service.ts'
import { defaultNoteActions } from '../documents/note-actions-service.ts'
import { defaultNoteDocuments } from '../documents/note-document-service.ts'
import { defaultNoteMove } from '../documents/note-move-service.ts'
import { defaultNotePreview } from '../documents/note-preview-service.ts'
import { defaultNoteRows } from '../documents/note-row-service.ts'
import { defaultNoteSessions } from '../documents/note-session.ts'
import { defaultOpenDocuments } from '../documents/open-documents-service.ts'
import { defaultTemplates } from '../documents/template-service.ts'
import { defaultTitleRename } from '../documents/title-rename-service.ts'
import { defaultEmbeddingIndex } from '../embeddings/embedding-index-service.ts'
import { defaultEmbeddingRuntime } from '../embeddings/embedding-runtime-service.ts'
import { defaultRetrieval } from '../embeddings/retrieval-service.ts'
import { defaultSemanticSearch } from '../embeddings/semantic-search-service.ts'
import { defaultEmbedMedia } from '../embeds/embed-media-service.ts'
import { defaultAssetStore } from '../graph/asset-store-service.ts'
import { defaultCaptureInbox } from '../graph/capture-inbox-service.ts'
import { defaultNoteCreation } from '../graph/note-creation-service.ts'
import { defaultNoteFile } from '../graph/note-file-service.ts'
import { defaultNoteLinkResolver } from '../graph/note-link-resolver-service.ts'
import { defaultBacklinks } from '../indexing/backlink-service.ts'
import { defaultDatabase } from '../indexing/database-service.ts'
import { defaultFileChanges } from '../indexing/file-change-service.ts'
import { defaultGraphStats } from '../indexing/graph-stats-service.ts'
import { defaultIndexLifecycle } from '../indexing/index-lifecycle-service.ts'
import { defaultIndexQuery } from '../indexing/index-query-service.ts'
import { defaultIndexStore } from '../indexing/index-store-service.ts'
import { defaultNoteList } from '../indexing/note-list-service.ts'
import { defaultNotePath } from '../indexing/note-path-service.ts'
import { defaultSearch } from '../indexing/search-service.ts'
import { defaultSuggestions } from '../indexing/suggestion-service.ts'
import { defaultWikiResolver } from '../indexing/wiki-resolver-service.ts'
import { defaultAppStore } from '../ipc/app-store-plugin.ts'
import { defaultIpc } from '../ipc/bridge.ts'
import { defaultIap } from '../ipc/iap-plugin.ts'
import { defaultICloudNative } from '../ipc/icloud-native-service.ts'
import { defaultHaptics } from '../ipc/mobile-haptics-plugin.ts'
import { defaultMobileStorage } from '../ipc/mobile-storage-service.ts'
import { defaultWebAuth } from '../ipc/web-auth-plugin.ts'
import { defaultLinkPreview } from '../link-preview/link-preview-service.ts'
import { defaultKeyboard } from '../mobile/keyboard-service.ts'
import { defaultShare } from '../mobile/share-service.ts'
import { defaultAppStoreEnvironment } from '../monetization/app-store-environment-service.ts'
import { defaultPaywall } from '../monetization/paywall-service.ts'
import { defaultSubscription } from '../monetization/subscription-service.ts'
import { defaultDeepLink } from '../navigation/deep-link-service.ts'
import { defaultLinkNavigation } from '../navigation/link-navigation-service.ts'
import { defaultNavigation } from '../navigation/navigation-service.ts'
import { defaultPrivacy } from '../privacy/privacy-service.ts'
import { defaultPaletteSearch } from '../search/palette-search-service.ts'
import { defaultWikiLinkSuggestions } from '../search/wiki-link-suggestion-service.ts'
import { defaultSecretStore } from '../secrets/secret-store-service.ts'
import { defaultSettings } from '../settings/settings-service.ts'
import { defaultTheme } from '../settings/theme-service.ts'
import { defaultBackups } from '../sync/backup-service.ts'
import { defaultConflictResolution } from '../sync/conflict-resolution-service.ts'
import { defaultSyncEngines } from '../sync/engine.ts'
import { defaultGistPublish } from '../sync/gist-publish-service.ts'
import { defaultGists } from '../sync/gist-service.ts'
import { defaultGitHostCredentials } from '../sync/git-host-credential-service.ts'
import { defaultGitRepository } from '../sync/git-repository-service.ts'
import { defaultGithubAuth } from '../sync/github-auth-service.ts'
import { defaultGithubRepos } from '../sync/github-repo-service.ts'
import { defaultICloudDownloads } from '../sync/icloud-download-service.ts'
import { defaultICloudMigration } from '../sync/icloud-migration-service.ts'
import { defaultICloudSyncs } from '../sync/icloud-sync-service.ts'
import { defaultSyncStatus } from '../sync/sync-status-service.ts'
import { defaultTasks } from '../tasks/task-service.ts'
import { defaultXArchive } from '../x-archive.ts'
import { defaultAgentSkill } from './agent-skill-service.ts'
import { defaultAppInfo } from './app-info-service.ts'
import { defaultClipboard } from './clipboard-service.ts'
import { defaultClock } from './clock-service.ts'
import { defaultDialog } from './dialog-service.ts'
import { defaultExceptionTelemetry } from './exception-telemetry-service.ts'
import { defaultHashService } from './hash-service.ts'
import { defaultHttp } from './http-service.ts'
import { defaultIdService } from './id-service.ts'
import { defaultImageCodec } from './image-codec-service.ts'
import { defaultLifecycle } from './lifecycle-service.ts'
import { defaultLogger } from './logger-service.ts'
import { defaultOpener } from './opener-service.ts'
import { defaultOperations } from './operations-service.ts'
import { defaultPath } from './path-service.ts'
import { defaultPersistenceFlush } from './persistence-flush-service.ts'
import { defaultPlatform } from './platform-service.ts'
import { defaultStorage } from './storage-service.ts'
import { defaultUpdate } from './update-service.ts'
import { defaultWebFetch } from './web-fetch-service.ts'
import { defaultWindow } from './window-service.ts'

const getters: { readonly [Key in keyof AppServices]?: () => AppServices[Key] } = {
  logger: defaultLogger,
  clock: defaultClock,
  id: defaultIdService,
  hash: defaultHashService,
  platform: defaultPlatform,
  storage: defaultStorage,
  http: defaultHttp,
  dialog: defaultDialog,
  clipboard: defaultClipboard,
  opener: defaultOpener,
  path: defaultPath,
  window: defaultWindow,
  lifecycle: defaultLifecycle,
  secretStore: defaultSecretStore,
  appInfo: defaultAppInfo,
  calendar: defaultCalendar,
  calendarEvents: defaultCalendarEvents,
  contacts: defaultContacts,
  contactSuggestions: defaultContactSuggestions,
  personNotes: defaultPersonNotes,
  meetings: defaultMeetings,
  agentSkill: defaultAgentSkill,
  mobileStorage: defaultMobileStorage,
  imageCodec: defaultImageCodec,
  exceptionTelemetry: defaultExceptionTelemetry,
  operations: defaultOperations,
  settings: defaultSettings,
  theme: defaultTheme,
  persistenceFlush: defaultPersistenceFlush,
  database: defaultDatabase,
  fileChanges: defaultFileChanges,
  indexStore: defaultIndexStore,
  embeddingRuntime: defaultEmbeddingRuntime,
  chatHistory: defaultChatHistory,
  update: defaultUpdate,
  navigation: defaultNavigation,
  deepLink: defaultDeepLink,
  linkNavigation: defaultLinkNavigation,
  gitRepository: defaultGitRepository,
  githubAuth: defaultGithubAuth,
  gitHostCredentials: defaultGitHostCredentials,
  githubRepos: defaultGithubRepos,
  syncEngines: defaultSyncEngines,
  backups: defaultBackups,
  gists: defaultGists,
  gistPublish: defaultGistPublish,
  icloudNative: defaultICloudNative,
  icloudSyncs: defaultICloudSyncs,
  icloudDownloads: defaultICloudDownloads,
  icloudMigration: defaultICloudMigration,
  conflictResolution: defaultConflictResolution,
  syncStatus: defaultSyncStatus,
  captureInbox: defaultCaptureInbox,
  webFetch: defaultWebFetch,
  xArchive: defaultXArchive,
  embedMedia: defaultEmbedMedia,
  linkPreview: defaultLinkPreview,
  audioRecorder: defaultAudioRecorder,
  haptics: defaultHaptics,
  iap: defaultIap,
  appStore: defaultAppStore,
  webAuth: defaultWebAuth,
  classicAccess: defaultClassicAccess,
  subscription: defaultSubscription,
  appStoreEnvironment: defaultAppStoreEnvironment,
  paywall: defaultPaywall,
  noteFile: defaultNoteFile,
  assetStore: defaultAssetStore,
  attachments: defaultAttachments,
  noteSessions: defaultNoteSessions,
  openDocuments: defaultOpenDocuments,
  noteMove: defaultNoteMove,
  titleRename: defaultTitleRename,
  keyboard: defaultKeyboard,
  share: defaultShare,
  noteDocuments: defaultNoteDocuments,
  notePreview: defaultNotePreview,
  tasks: defaultTasks,
  noteActions: defaultNoteActions,
  noteRows: defaultNoteRows,
  dailyNotes: defaultDailyNotes,
  templates: defaultTemplates,
  wikiLinkSuggestions: defaultWikiLinkSuggestions,
  paletteSearch: defaultPaletteSearch,
  indexQuery: defaultIndexQuery,
  wikiResolver: defaultWikiResolver,
  backlinks: defaultBacklinks,
  search: defaultSearch,
  suggestions: defaultSuggestions,
  noteList: defaultNoteList,
  graphStats: defaultGraphStats,
  notePath: defaultNotePath,
  noteLinkResolver: defaultNoteLinkResolver,
  noteCreation: defaultNoteCreation,
  privacy: defaultPrivacy,
  indexLifecycle: defaultIndexLifecycle,
  retrieval: defaultRetrieval,
  embeddingIndex: defaultEmbeddingIndex,
  semanticSearch: defaultSemanticSearch,
  aiCredentials: defaultAiCredentials,
  aiKeyValidation: defaultAiKeyValidation,
  languageModel: defaultLanguageModel,
  aiPrompts: defaultAiPrompts,
  keymap: defaultKeymap,
  commands: defaultCommands,
  nativeMenu: defaultNativeMenu,
  aiProviderConfig: defaultAiProviderConfig,
  selectionTransform: defaultSelectionTransform,
  pageDescriber: defaultPageDescriber,
  assetDescriber: defaultAssetDescriber,
  transcription: defaultTranscription,
  transcriptEnrichment: defaultTranscriptEnrichment,
  backlinkTarget: defaultBacklinkTarget,
  capture: defaultCapture,
  audioMemo: defaultAudioMemo,
  nativeAction: defaultNativeAction,
  mobileAudioMemo: defaultMobileAudioMemo,
  assetPrivacy: defaultAssetPrivacy,
  assetDescription: defaultAssetDescription,
  ipc: defaultIpc,
}

const NO_DEFAULT = [
  'graphSession',
  'mobileOnboarding',
  'noteTools',
  'chatEngine',
  'chatGraphContext',
  'chatSessions',
] as const satisfies readonly (keyof AppServices)[]

function createDefaultAppServices(): AppServices {
  const view = {}
  for (const [key, get] of Object.entries(getters)) {
    Object.defineProperty(view, key, { get, enumerable: true })
  }
  for (const key of NO_DEFAULT) {
    Object.defineProperty(view, key, {
      get: () => {
        throw new Error(
          `\`${key}\` has no process-wide default: render inside an AppServicesProvider`,
        )
      },
      enumerable: true,
    })
  }
  return view as AppServices
}

let view: AppServices | null = null

/**
 * {@link AppServices} over the process-wide defaults: each member is its
 * `defaultXxx()` at the time it is read. Transitional, for code that asks
 * for the app services where none were provided; it goes away with the
 * default instances.
 */
export function defaultAppServices(): AppServices {
  view ??= createDefaultAppServices()
  return view
}
