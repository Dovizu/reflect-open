import { setDefaultChatHistory } from '../ai/chat/chat-history-service.ts'
import { setDefaultCaptureInbox } from '../graph/capture-inbox-service.ts'
import { setDefaultICloudNative } from '../ipc/icloud-native-service.ts'
import { setDefaultGitRepository } from '../sync/git-repository-service.ts'
import { setDefaultXArchive } from '../x-archive.ts'
import { setDefaultWebFetch } from './web-fetch-service.ts'
import { setDefaultAudioRecorder } from '../audio/default-audio-recorder.ts'
import { setDefaultCalendar } from '../calendar/calendar-service.ts'
import { setDefaultContacts } from '../contacts/contacts-service.ts'
import { setDefaultAssetStore } from '../graph/asset-store-service.ts'
import { setDefaultNoteFile } from '../graph/note-file-service.ts'
import { setDefaultEmbeddingRuntime } from '../embeddings/embedding-runtime-service.ts'
import { setDefaultDatabase } from '../indexing/database-service.ts'
import { setDefaultBacklinks } from '../indexing/backlink-service.ts'
import { setDefaultFileChanges } from '../indexing/file-change-service.ts'
import { setDefaultGraphStats } from '../indexing/graph-stats-service.ts'
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
import { setDefaultWebAuth } from '../ipc/web-auth-plugin.ts'
import { setDefaultSecretStore } from '../secrets/secret-store-service.ts'
import { setDefaultSettings } from '../settings/settings-service.ts'
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
import { setDefaultPlatform } from './platform-service.ts'
import { setDefaultStorage } from './storage-service.ts'
import { setDefaultUpdate } from './update-service.ts'
import { setDefaultWindow } from './window-service.ts'

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
  setDefaultDatabase(services.database)
  setDefaultFileChanges(services.fileChanges)
  setDefaultIndexStore(services.indexStore)
  setDefaultEmbeddingRuntime(services.embeddingRuntime)
  setDefaultChatHistory(services.chatHistory)
  setDefaultUpdate(services.update)
  setDefaultGitRepository(services.gitRepository)
  setDefaultICloudNative(services.icloudNative)
  setDefaultCaptureInbox(services.captureInbox)
  setDefaultWebFetch(services.webFetch)
  setDefaultXArchive(services.xArchive)
  setDefaultAudioRecorder(services.audioRecorder)
  setDefaultHaptics(services.haptics ?? null)
  setDefaultIap(services.iap ?? null)
  setDefaultAppStore(services.appStore ?? null)
  setDefaultWebAuth(services.webAuth ?? null)
  setDefaultNoteFile(services.noteFile)
  setDefaultAssetStore(services.assetStore)
  setDefaultIndexQuery(services.indexQuery)
  setDefaultWikiResolver(services.wikiResolver)
  setDefaultBacklinks(services.backlinks)
  setDefaultSearch(services.search)
  setDefaultSuggestions(services.suggestions)
  setDefaultNoteList(services.noteList)
  setDefaultGraphStats(services.graphStats)
  setDefaultNotePath(services.notePath)
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
  setDefaultDatabase(null)
  setDefaultFileChanges(null)
  setDefaultIndexStore(null)
  setDefaultEmbeddingRuntime(null)
  setDefaultChatHistory(null)
  setDefaultUpdate(null)
  setDefaultGitRepository(null)
  setDefaultICloudNative(null)
  setDefaultCaptureInbox(null)
  setDefaultWebFetch(null)
  setDefaultXArchive(null)
  setDefaultAudioRecorder(null)
  setDefaultHaptics(null)
  setDefaultIap(null)
  setDefaultAppStore(null)
  setDefaultWebAuth(null)
  setDefaultNoteFile(null)
  setDefaultAssetStore(null)
  setDefaultIndexQuery(null)
  setDefaultWikiResolver(null)
  setDefaultBacklinks(null)
  setDefaultSearch(null)
  setDefaultSuggestions(null)
  setDefaultNoteList(null)
  setDefaultGraphStats(null)
  setDefaultNotePath(null)
  setDefaultIpc(null)
}
