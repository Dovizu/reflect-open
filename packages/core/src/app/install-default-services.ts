import { setDefaultAiCredentials } from '../ai/ai-credential-service.ts'
import { setDefaultAiKeyValidation } from '../ai/ai-key-validation-service.ts'
import { setDefaultAiPrompts } from '../ai/ai-prompt-service.ts'
import { setDefaultAiProviderConfig } from '../ai/ai-provider-config-service.ts'
import { setDefaultLanguageModel } from '../ai/language-model-service.ts'
import { setDefaultAssetDescriber } from '../ai/asset-describer-service.ts'
import { setDefaultPageDescriber } from '../ai/page-describer-service.ts'
import { setDefaultSelectionTransform } from '../ai/selection-transform-service.ts'
import { setDefaultTranscriptEnrichment } from '../ai/transcript-enrichment-service.ts'
import { setDefaultTranscription } from '../ai/transcription-service.ts'
import { setDefaultChatHistory } from '../ai/chat/chat-history-service.ts'
import { setDefaultCaptureInbox } from '../graph/capture-inbox-service.ts'
import { setDefaultICloudNative } from '../ipc/icloud-native-service.ts'
import { setDefaultGists } from '../sync/gist-service.ts'
import { setDefaultGitHostCredentials } from '../sync/git-host-credential-service.ts'
import { setDefaultGitRepository } from '../sync/git-repository-service.ts'
import { setDefaultGithubAuth } from '../sync/github-auth-service.ts'
import { setDefaultGithubRepos } from '../sync/github-repo-service.ts'
import { setDefaultXArchive } from '../x-archive.ts'
import { setDefaultWebFetch } from './web-fetch-service.ts'
import { setDefaultAudioRecorder } from '../audio/default-audio-recorder.ts'
import { setDefaultClassicAccess } from '../classic/classic-access-service.ts'
import { setDefaultAppStoreEnvironment } from '../monetization/app-store-environment-service.ts'
import { setDefaultPaywall } from '../monetization/paywall-service.ts'
import { setDefaultSubscription } from '../monetization/subscription-service.ts'
import { setDefaultCalendar } from '../calendar/calendar-service.ts'
import { setDefaultContacts } from '../contacts/contacts-service.ts'
import { setDefaultAssetStore } from '../graph/asset-store-service.ts'
import { setDefaultNoteCreation } from '../graph/note-creation-service.ts'
import { setDefaultNoteFile } from '../graph/note-file-service.ts'
import { setDefaultNoteLinkResolver } from '../graph/note-link-resolver-service.ts'
import { setDefaultAttachments } from '../documents/attachment-service.ts'
import { setDefaultNoteDocuments } from '../documents/note-document-service.ts'
import { setDefaultNoteSessions } from '../documents/note-session.ts'
import { setDefaultNoteMove } from '../documents/note-move-service.ts'
import { setDefaultOpenDocuments } from '../documents/open-documents-service.ts'
import { setDefaultTitleRename } from '../documents/title-rename-service.ts'
import { setDefaultEmbeddingIndex } from '../embeddings/embedding-index-service.ts'
import { setDefaultEmbeddingRuntime } from '../embeddings/embedding-runtime-service.ts'
import { setDefaultRetrieval } from '../embeddings/retrieval-service.ts'
import { setDefaultSemanticSearch } from '../embeddings/semantic-search-service.ts'
import { setDefaultDatabase } from '../indexing/database-service.ts'
import { setDefaultBacklinks } from '../indexing/backlink-service.ts'
import { setDefaultFileChanges } from '../indexing/file-change-service.ts'
import { setDefaultGraphStats } from '../indexing/graph-stats-service.ts'
import { setDefaultIndexLifecycle } from '../indexing/index-lifecycle-service.ts'
import { setDefaultIndexQuery } from '../indexing/index-query-service.ts'
import { setDefaultNoteList } from '../indexing/note-list-service.ts'
import { setDefaultNotePath } from '../indexing/note-path-service.ts'
import { setDefaultSearch } from '../indexing/search-service.ts'
import { setDefaultSuggestions } from '../indexing/suggestion-service.ts'
import { setDefaultWikiResolver } from '../indexing/wiki-resolver-service.ts'
import { setDefaultIndexStore } from '../indexing/index-store-service.ts'
import { setDefaultAppStore } from '../ipc/app-store-plugin.ts'
import { setDefaultIpc } from '../ipc/bridge.ts'
import { setDefaultIap } from '../ipc/iap-plugin.ts'
import { setDefaultHaptics } from '../ipc/mobile-haptics-plugin.ts'
import { setDefaultMobileStorage } from '../ipc/mobile-storage-service.ts'
import { setDefaultKeyboard } from '../mobile/keyboard-service.ts'
import { setDefaultShare } from '../mobile/share-service.ts'
import { setDefaultWebAuth } from '../ipc/web-auth-plugin.ts'
import { setDefaultDeepLink } from '../navigation/deep-link-service.ts'
import { setDefaultNavigation } from '../navigation/navigation-service.ts'
import { setDefaultPrivacy } from '../privacy/privacy-service.ts'
import { setDefaultSecretStore } from '../secrets/secret-store-service.ts'
import { setDefaultSettings } from '../settings/settings-service.ts'
import { setDefaultTheme } from '../settings/theme-service.ts'
import { setDefaultAgentSkill } from './agent-skill-service.ts'
import { setDefaultAppInfo } from './app-info-service.ts'
import { setDefaultClipboard } from './clipboard-service.ts'
import { setDefaultClock } from './clock-service.ts'
import type { AppServices } from './create-app-services.ts'
import { setDefaultDialog } from './dialog-service.ts'
import { setDefaultExceptionTelemetry } from './exception-telemetry-service.ts'
import { setDefaultHashService } from './hash-service.ts'
import { setDefaultHttp } from './http-service.ts'
import { setDefaultIdService } from './id-service.ts'
import { setDefaultImageCodec } from './image-codec-service.ts'
import { setDefaultLifecycle } from './lifecycle-service.ts'
import { setDefaultLogger } from './logger-service.ts'
import { setDefaultOperations } from './operations-service.ts'
import { setDefaultOpener } from './opener-service.ts'
import { setDefaultPath } from './path-service.ts'
import { setDefaultPersistenceFlush } from './persistence-flush-service.ts'
import { setDefaultPlatform } from './platform-service.ts'
import { setDefaultStorage } from './storage-service.ts'
import { setDefaultUpdate } from './update-service.ts'
import { setDefaultWindow } from './window-service.ts'
import { setDefaultCommands } from '../commands/command-service.ts'
import { setDefaultKeymap } from '../commands/keymap-service.ts'
import { setDefaultNativeMenu } from '../commands/native-menu-service.ts'

/** Point every process-wide `defaultXxx()` at the matching service of `services`. */
export function installDefaultServices(services: AppServices): void {
  setDefaultLogger(services.logger)
  setDefaultClock(services.clock)
  setDefaultIdService(services.id)
  setDefaultHashService(services.hash)
  setDefaultPlatform(services.platform)
  setDefaultStorage(services.storage)
  setDefaultHttp(services.http)
  setDefaultDialog(services.dialog)
  setDefaultClipboard(services.clipboard)
  setDefaultOpener(services.opener)
  setDefaultPath(services.path)
  setDefaultWindow(services.window)
  setDefaultLifecycle(services.lifecycle)
  setDefaultSecretStore(services.secretStore)
  setDefaultAppInfo(services.appInfo)
  setDefaultCalendar(services.calendar)
  setDefaultContacts(services.contacts)
  setDefaultAgentSkill(services.agentSkill)
  setDefaultMobileStorage(services.mobileStorage)
  setDefaultImageCodec(services.imageCodec)
  setDefaultExceptionTelemetry(services.exceptionTelemetry)
  setDefaultOperations(services.operations)
  setDefaultSettings(services.settings)
  setDefaultTheme(services.theme)
  setDefaultPersistenceFlush(services.persistenceFlush)
  setDefaultDatabase(services.database)
  setDefaultFileChanges(services.fileChanges)
  setDefaultIndexStore(services.indexStore)
  setDefaultEmbeddingRuntime(services.embeddingRuntime)
  setDefaultChatHistory(services.chatHistory)
  setDefaultUpdate(services.update)
  setDefaultNavigation(services.navigation)
  setDefaultDeepLink(services.deepLink)
  setDefaultGitRepository(services.gitRepository)
  setDefaultGithubAuth(services.githubAuth)
  setDefaultGitHostCredentials(services.gitHostCredentials)
  setDefaultGithubRepos(services.githubRepos)
  setDefaultGists(services.gists)
  setDefaultICloudNative(services.icloudNative)
  setDefaultCaptureInbox(services.captureInbox)
  setDefaultWebFetch(services.webFetch)
  setDefaultXArchive(services.xArchive)
  setDefaultAudioRecorder(services.audioRecorder)
  setDefaultHaptics(services.haptics ?? null)
  setDefaultIap(services.iap ?? null)
  setDefaultAppStore(services.appStore ?? null)
  setDefaultWebAuth(services.webAuth ?? null)
  setDefaultClassicAccess(services.classicAccess)
  setDefaultSubscription(services.subscription ?? null)
  setDefaultAppStoreEnvironment(services.appStoreEnvironment ?? null)
  setDefaultPaywall(services.paywall ?? null)
  setDefaultNoteFile(services.noteFile)
  setDefaultAssetStore(services.assetStore)
  setDefaultAttachments(services.attachments)
  setDefaultNoteSessions(services.noteSessions)
  setDefaultOpenDocuments(services.openDocuments)
  setDefaultNoteMove(services.noteMove)
  setDefaultTitleRename(services.titleRename)
  setDefaultKeyboard(services.keyboard)
  setDefaultShare(services.share)
  setDefaultNoteDocuments(services.noteDocuments)
  setDefaultIndexQuery(services.indexQuery)
  setDefaultWikiResolver(services.wikiResolver)
  setDefaultBacklinks(services.backlinks)
  setDefaultSearch(services.search)
  setDefaultSuggestions(services.suggestions)
  setDefaultNoteList(services.noteList)
  setDefaultGraphStats(services.graphStats)
  setDefaultNotePath(services.notePath)
  setDefaultNoteLinkResolver(services.noteLinkResolver)
  setDefaultNoteCreation(services.noteCreation)
  setDefaultPrivacy(services.privacy)
  setDefaultIndexLifecycle(services.indexLifecycle)
  setDefaultRetrieval(services.retrieval)
  setDefaultEmbeddingIndex(services.embeddingIndex)
  setDefaultSemanticSearch(services.semanticSearch)
  setDefaultAiCredentials(services.aiCredentials)
  setDefaultAiKeyValidation(services.aiKeyValidation)
  setDefaultLanguageModel(services.languageModel)
  setDefaultAiPrompts(services.aiPrompts)
  setDefaultKeymap(services.keymap)
  setDefaultCommands(services.commands)
  setDefaultNativeMenu(services.nativeMenu)
  setDefaultAiProviderConfig(services.aiProviderConfig)
  setDefaultSelectionTransform(services.selectionTransform)
  setDefaultPageDescriber(services.pageDescriber)
  setDefaultAssetDescriber(services.assetDescriber)
  setDefaultTranscription(services.transcription)
  setDefaultTranscriptEnrichment(services.transcriptEnrichment)
  setDefaultIpc(services.ipc)
}

/** Reset every process-wide `defaultXxx()` to its state before any install. */
export function resetDefaultServices(): void {
  setDefaultLogger(null)
  setDefaultClock(null)
  setDefaultIdService(null)
  setDefaultHashService(null)
  setDefaultPlatform(null)
  setDefaultStorage(null)
  setDefaultHttp(null)
  setDefaultDialog(null)
  setDefaultClipboard(null)
  setDefaultOpener(null)
  setDefaultPath(null)
  setDefaultWindow(null)
  setDefaultLifecycle(null)
  setDefaultSecretStore(null)
  setDefaultAppInfo(null)
  setDefaultCalendar(null)
  setDefaultContacts(null)
  setDefaultAgentSkill(null)
  setDefaultMobileStorage(null)
  setDefaultImageCodec(null)
  setDefaultExceptionTelemetry(null)
  setDefaultOperations(null)
  setDefaultSettings(null)
  setDefaultTheme(null)
  setDefaultPersistenceFlush(null)
  setDefaultDatabase(null)
  setDefaultFileChanges(null)
  setDefaultIndexStore(null)
  setDefaultEmbeddingRuntime(null)
  setDefaultChatHistory(null)
  setDefaultUpdate(null)
  setDefaultNavigation(null)
  setDefaultDeepLink(null)
  setDefaultGitRepository(null)
  setDefaultGithubAuth(null)
  setDefaultGitHostCredentials(null)
  setDefaultGithubRepos(null)
  setDefaultGists(null)
  setDefaultICloudNative(null)
  setDefaultCaptureInbox(null)
  setDefaultWebFetch(null)
  setDefaultXArchive(null)
  setDefaultAudioRecorder(null)
  setDefaultHaptics(null)
  setDefaultIap(null)
  setDefaultAppStore(null)
  setDefaultWebAuth(null)
  setDefaultClassicAccess(null)
  setDefaultSubscription(null)
  setDefaultAppStoreEnvironment(null)
  setDefaultPaywall(null)
  setDefaultNoteFile(null)
  setDefaultAssetStore(null)
  setDefaultAttachments(null)
  setDefaultNoteSessions(null)
  setDefaultOpenDocuments(null)
  setDefaultNoteMove(null)
  setDefaultTitleRename(null)
  setDefaultKeyboard(null)
  setDefaultShare(null)
  setDefaultNoteDocuments(null)
  setDefaultIndexQuery(null)
  setDefaultWikiResolver(null)
  setDefaultBacklinks(null)
  setDefaultSearch(null)
  setDefaultSuggestions(null)
  setDefaultNoteList(null)
  setDefaultGraphStats(null)
  setDefaultNotePath(null)
  setDefaultNoteLinkResolver(null)
  setDefaultNoteCreation(null)
  setDefaultPrivacy(null)
  setDefaultIndexLifecycle(null)
  setDefaultRetrieval(null)
  setDefaultEmbeddingIndex(null)
  setDefaultSemanticSearch(null)
  setDefaultAiCredentials(null)
  setDefaultAiKeyValidation(null)
  setDefaultLanguageModel(null)
  setDefaultAiPrompts(null)
  setDefaultKeymap(null)
  setDefaultCommands(null)
  setDefaultNativeMenu(null)
  setDefaultAiProviderConfig(null)
  setDefaultSelectionTransform(null)
  setDefaultPageDescriber(null)
  setDefaultAssetDescriber(null)
  setDefaultTranscription(null)
  setDefaultTranscriptEnrichment(null)
  setDefaultIpc(null)
}
