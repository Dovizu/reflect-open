import { afterEach, describe, expect, it } from 'vitest'
import { defaultAudioRecorder } from '../audio/default-audio-recorder.ts'
import { defaultCommands } from '../commands/command-service.ts'
import { defaultKeymap } from '../commands/keymap-service.ts'
import { defaultNativeMenu } from '../commands/native-menu-service.ts'
import { defaultAppStore } from '../ipc/app-store-plugin.ts'
import { defaultIpc, getBridge, hasBridge } from '../ipc/bridge.ts'
import { defaultChatHistory } from '../ai/chat/chat-history-service.ts'
import { defaultEmbeddingRuntime } from '../embeddings/embedding-runtime-service.ts'
import { defaultBacklinkTarget } from '../capture/backlink-target-service.ts'
import { defaultCapture } from '../capture/capture-service.ts'
import { defaultAudioMemo } from '../audio/audio-memo-service.ts'
import { defaultMobileAudioMemo } from '../audio/mobile-audio-memo-service.ts'
import { defaultNativeAction } from '../audio/native-action-service.ts'
import { defaultCaptureInbox } from '../graph/capture-inbox-service.ts'
import { defaultICloudNative } from '../ipc/icloud-native-service.ts'
import { defaultGists } from '../sync/gist-service.ts'
import { defaultGitHostCredentials } from '../sync/git-host-credential-service.ts'
import { defaultGitRepository } from '../sync/git-repository-service.ts'
import { defaultGithubAuth } from '../sync/github-auth-service.ts'
import { defaultGithubRepos } from '../sync/github-repo-service.ts'
import { defaultSyncEngines } from '../sync/engine.ts'
import { defaultBackups } from '../sync/backup-service.ts'
import { defaultConflictResolution } from '../sync/conflict-resolution-service.ts'
import { defaultICloudDownloads } from '../sync/icloud-download-service.ts'
import { defaultICloudMigration } from '../sync/icloud-migration-service.ts'
import { defaultICloudSyncs } from '../sync/icloud-sync-service.ts'
import { defaultSyncStatus } from '../sync/sync-status-service.ts'
import { defaultXArchive } from '../x-archive.ts'
import { defaultWebFetch } from './web-fetch-service.ts'
import { defaultIap } from '../ipc/iap-plugin.ts'
import { defaultHaptics } from '../ipc/mobile-haptics-plugin.ts'
import { defaultWebAuth } from '../ipc/web-auth-plugin.ts'
import { defaultClassicAccess } from '../classic/classic-access-service.ts'
import { defaultAppStoreEnvironment } from '../monetization/app-store-environment-service.ts'
import { defaultPaywall } from '../monetization/paywall-service.ts'
import { defaultSubscription } from '../monetization/subscription-service.ts'
import { defaultCalendarEvents } from '../calendar/calendar-events-service.ts'
import { defaultCalendar } from '../calendar/calendar-service.ts'
import { defaultContactSuggestions } from '../contacts/contact-suggestion-service.ts'
import { defaultContacts } from '../contacts/contacts-service.ts'
import { defaultMeetings } from '../contacts/meeting-service.ts'
import { defaultPersonNotes } from '../contacts/person-note-service.ts'
import { defaultAssetStore } from '../graph/asset-store-service.ts'
import { defaultNoteCreation } from '../graph/note-creation-service.ts'
import { defaultNoteFile } from '../graph/note-file-service.ts'
import { defaultNoteLinkResolver } from '../graph/note-link-resolver-service.ts'
import { defaultPrivacy } from '../privacy/privacy-service.ts'
import { defaultAttachments } from '../documents/attachment-service.ts'
import { defaultNoteSessions } from '../documents/note-session.ts'
import { defaultNoteMove } from '../documents/note-move-service.ts'
import { defaultNoteDocuments } from '../documents/note-document-service.ts'
import { defaultNotePreview } from '../documents/note-preview-service.ts'
import { defaultTasks } from '../tasks/task-service.ts'
import { defaultOpenDocuments } from '../documents/open-documents-service.ts'
import { defaultTitleRename } from '../documents/title-rename-service.ts'
import { defaultDatabase } from '../indexing/database-service.ts'
import { defaultBacklinks } from '../indexing/backlink-service.ts'
import { defaultFileChanges } from '../indexing/file-change-service.ts'
import { defaultGraphStats } from '../indexing/graph-stats-service.ts'
import { defaultIndexQuery } from '../indexing/index-query-service.ts'
import { defaultNoteList } from '../indexing/note-list-service.ts'
import { defaultNotePath } from '../indexing/note-path-service.ts'
import { defaultSearch } from '../indexing/search-service.ts'
import { defaultSuggestions } from '../indexing/suggestion-service.ts'
import { defaultWikiResolver } from '../indexing/wiki-resolver-service.ts'
import { defaultIndexStore } from '../indexing/index-store-service.ts'
import { defaultMobileStorage } from '../ipc/mobile-storage-service.ts'
import { defaultSecretStore } from '../secrets/secret-store-service.ts'
import { defaultTheme } from '../settings/theme-service.ts'
import { createTestAppServices } from '../testing/services.ts'
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
import { installDefaultServices, resetDefaultServices } from './install-default-services.ts'
import { defaultLifecycle } from './lifecycle-service.ts'
import { defaultLogger } from './logger-service.ts'
import { defaultOperations } from './operations-service.ts'
import { defaultOpener } from './opener-service.ts'
import { defaultPath } from './path-service.ts'
import { defaultPersistenceFlush } from './persistence-flush-service.ts'
import { defaultPlatform } from './platform-service.ts'
import { defaultStorage } from './storage-service.ts'
import { defaultUpdate } from './update-service.ts'
import { defaultNavigation } from '../navigation/navigation-service.ts'
import { defaultWindow } from './window-service.ts'
import { defaultPaletteSearch } from '../search/palette-search-service.ts'
import { defaultWikiLinkSuggestions } from '../search/wiki-link-suggestion-service.ts'

afterEach(() => {
  resetDefaultServices()
})

describe('installDefaultServices', () => {
  it('points every default at the composed services', () => {
    const services = createTestAppServices()
    installDefaultServices(services)
    expect(defaultIpc()).toBe(services.ipc)
    expect(getBridge()).toBe(services.ipc.transport)
    expect(defaultLogger()).toBe(services.logger)
    expect(defaultClock()).toBe(services.clock)
    expect(defaultIdService()).toBe(services.id)
    expect(defaultHashService()).toBe(services.hash)
    expect(defaultPlatform()).toBe(services.platform)
    expect(defaultStorage()).toBe(services.storage)
    expect(defaultHttp()).toBe(services.http)
    expect(defaultDialog()).toBe(services.dialog)
    expect(defaultClipboard()).toBe(services.clipboard)
    expect(defaultOpener()).toBe(services.opener)
    expect(defaultPath()).toBe(services.path)
    expect(defaultWindow()).toBe(services.window)
    expect(defaultLifecycle()).toBe(services.lifecycle)
    expect(defaultSecretStore()).toBe(services.secretStore)
    expect(defaultAppInfo()).toBe(services.appInfo)
    expect(defaultCalendar()).toBe(services.calendar)
    expect(defaultContacts()).toBe(services.contacts)
    expect(defaultCalendarEvents()).toBe(services.calendarEvents)
    expect(defaultContactSuggestions()).toBe(services.contactSuggestions)
    expect(defaultPersonNotes()).toBe(services.personNotes)
    expect(defaultMeetings()).toBe(services.meetings)
    expect(defaultAgentSkill()).toBe(services.agentSkill)
    expect(defaultMobileStorage()).toBe(services.mobileStorage)
    expect(defaultImageCodec()).toBe(services.imageCodec)
    expect(defaultExceptionTelemetry()).toBe(services.exceptionTelemetry)
    expect(defaultOperations()).toBe(services.operations)
    expect(defaultTheme()).toBe(services.theme)
    expect(defaultPersistenceFlush()).toBe(services.persistenceFlush)
    expect(defaultDatabase()).toBe(services.database)
    expect(defaultFileChanges()).toBe(services.fileChanges)
    expect(defaultIndexStore()).toBe(services.indexStore)
    expect(defaultEmbeddingRuntime()).toBe(services.embeddingRuntime)
    expect(defaultChatHistory()).toBe(services.chatHistory)
    expect(defaultUpdate()).toBe(services.update)
    expect(defaultNavigation()).toBe(services.navigation)
    expect(defaultGitRepository()).toBe(services.gitRepository)
    expect(defaultGithubAuth()).toBe(services.githubAuth)
    expect(defaultGitHostCredentials()).toBe(services.gitHostCredentials)
    expect(defaultGithubRepos()).toBe(services.githubRepos)
    expect(defaultGists()).toBe(services.gists)
    expect(defaultSyncEngines()).toBe(services.syncEngines)
    expect(defaultBackups()).toBe(services.backups)
    expect(defaultICloudNative()).toBe(services.icloudNative)
    expect(defaultICloudSyncs()).toBe(services.icloudSyncs)
    expect(defaultICloudDownloads()).toBe(services.icloudDownloads)
    expect(defaultICloudMigration()).toBe(services.icloudMigration)
    expect(defaultConflictResolution()).toBe(services.conflictResolution)
    expect(defaultSyncStatus()).toBe(services.syncStatus)
    expect(defaultCaptureInbox()).toBe(services.captureInbox)
    expect(defaultBacklinkTarget()).toBe(services.backlinkTarget)
    expect(defaultCapture()).toBe(services.capture)
    expect(defaultWebFetch()).toBe(services.webFetch)
    expect(defaultXArchive()).toBe(services.xArchive)
    expect(defaultAudioRecorder()).toBe(services.audioRecorder)
    expect(defaultAudioMemo()).toBe(services.audioMemo)
    expect(defaultNativeAction()).toBe(services.nativeAction)
    expect(defaultMobileAudioMemo()).toBe(services.mobileAudioMemo)
    expect(defaultHaptics()).toBe(services.haptics)
    expect(defaultIap()).toBe(services.iap)
    expect(defaultAppStore()).toBe(services.appStore)
    expect(defaultWebAuth()).toBe(services.webAuth)
    expect(defaultClassicAccess()).toBe(services.classicAccess)
    expect(defaultSubscription()).toBe(services.subscription)
    expect(defaultAppStoreEnvironment()).toBe(services.appStoreEnvironment)
    expect(defaultPaywall()).toBe(services.paywall)
    expect(defaultNoteFile()).toBe(services.noteFile)
    expect(defaultAssetStore()).toBe(services.assetStore)
    expect(defaultAttachments()).toBe(services.attachments)
    expect(defaultNoteSessions()).toBe(services.noteSessions)
    expect(defaultOpenDocuments()).toBe(services.openDocuments)
    expect(defaultNoteMove()).toBe(services.noteMove)
    expect(defaultTitleRename()).toBe(services.titleRename)
    expect(defaultNoteDocuments()).toBe(services.noteDocuments)
    expect(defaultNotePreview()).toBe(services.notePreview)
    expect(defaultTasks()).toBe(services.tasks)
    expect(defaultIndexQuery()).toBe(services.indexQuery)
    expect(defaultWikiResolver()).toBe(services.wikiResolver)
    expect(defaultBacklinks()).toBe(services.backlinks)
    expect(defaultSearch()).toBe(services.search)
    expect(defaultSuggestions()).toBe(services.suggestions)
    expect(defaultNoteList()).toBe(services.noteList)
    expect(defaultGraphStats()).toBe(services.graphStats)
    expect(defaultNotePath()).toBe(services.notePath)
    expect(defaultNoteLinkResolver()).toBe(services.noteLinkResolver)
    expect(defaultNoteCreation()).toBe(services.noteCreation)
    expect(defaultPrivacy()).toBe(services.privacy)
    expect(defaultKeymap()).toBe(services.keymap)
    expect(defaultCommands()).toBe(services.commands)
    expect(defaultNativeMenu()).toBe(services.nativeMenu)
    expect(defaultWikiLinkSuggestions()).toBe(services.wikiLinkSuggestions)
    expect(defaultPaletteSearch()).toBe(services.paletteSearch)
  })

  it('leaves the bridge-backed plugin defaults where a service is absent', () => {
    const {
      haptics,
      iap,
      appStore,
      webAuth,
      subscription,
      appStoreEnvironment,
      paywall,
      nativeAction,
      mobileAudioMemo,
      ...desktop
    } = createTestAppServices()
    installDefaultServices(desktop)
    expect(defaultHaptics()).not.toBe(haptics)
    expect(defaultIap()).not.toBe(iap)
    expect(defaultAppStore()).not.toBe(appStore)
    expect(defaultWebAuth()).not.toBe(webAuth)
    expect(defaultSubscription()).not.toBe(subscription)
    expect(defaultAppStoreEnvironment()).not.toBe(appStoreEnvironment)
    expect(defaultPaywall()).not.toBe(paywall)
    expect(defaultNativeAction()).not.toBe(nativeAction)
    expect(defaultMobileAudioMemo()).not.toBe(mobileAudioMemo)
  })
})

describe('resetDefaultServices', () => {
  it('drops every installed service', () => {
    const services = createTestAppServices()
    installDefaultServices(services)
    resetDefaultServices()
    expect(hasBridge()).toBe(false)
    expect(defaultLogger()).not.toBe(services.logger)
    expect(defaultClock()).not.toBe(services.clock)
    expect(defaultPlatform()).not.toBe(services.platform)
    expect(defaultWindow()).not.toBe(services.window)
    expect(defaultCalendar()).not.toBe(services.calendar)
    expect(defaultImageCodec()).not.toBe(services.imageCodec)
    expect(defaultExceptionTelemetry()).not.toBe(services.exceptionTelemetry)
    expect(defaultOperations()).not.toBe(services.operations)
    expect(defaultTheme()).not.toBe(services.theme)
    expect(defaultPersistenceFlush()).not.toBe(services.persistenceFlush)
    expect(defaultDatabase()).not.toBe(services.database)
    expect(defaultFileChanges()).not.toBe(services.fileChanges)
    expect(defaultIndexStore()).not.toBe(services.indexStore)
    expect(defaultEmbeddingRuntime()).not.toBe(services.embeddingRuntime)
    expect(defaultChatHistory()).not.toBe(services.chatHistory)
    expect(defaultUpdate()).not.toBe(services.update)
    expect(defaultNavigation()).not.toBe(services.navigation)
    expect(defaultGitRepository()).not.toBe(services.gitRepository)
    expect(defaultGithubAuth()).not.toBe(services.githubAuth)
    expect(defaultGitHostCredentials()).not.toBe(services.gitHostCredentials)
    expect(defaultGithubRepos()).not.toBe(services.githubRepos)
    expect(defaultGists()).not.toBe(services.gists)
    expect(defaultSyncEngines()).not.toBe(services.syncEngines)
    expect(defaultBackups()).not.toBe(services.backups)
    expect(defaultICloudNative()).not.toBe(services.icloudNative)
    expect(defaultICloudSyncs()).not.toBe(services.icloudSyncs)
    expect(defaultICloudDownloads()).not.toBe(services.icloudDownloads)
    expect(defaultICloudMigration()).not.toBe(services.icloudMigration)
    expect(defaultConflictResolution()).not.toBe(services.conflictResolution)
    expect(defaultSyncStatus()).not.toBe(services.syncStatus)
    expect(defaultCaptureInbox()).not.toBe(services.captureInbox)
    expect(defaultBacklinkTarget()).not.toBe(services.backlinkTarget)
    expect(defaultCapture()).not.toBe(services.capture)
    expect(defaultWebFetch()).not.toBe(services.webFetch)
    expect(defaultXArchive()).not.toBe(services.xArchive)
    expect(defaultAudioRecorder()).not.toBe(services.audioRecorder)
    expect(defaultAudioMemo()).not.toBe(services.audioMemo)
    expect(defaultNativeAction()).not.toBe(services.nativeAction)
    expect(defaultMobileAudioMemo()).not.toBe(services.mobileAudioMemo)
    expect(defaultHaptics()).not.toBe(services.haptics)
    expect(defaultIap()).not.toBe(services.iap)
    expect(defaultAppStore()).not.toBe(services.appStore)
    expect(defaultWebAuth()).not.toBe(services.webAuth)
    expect(defaultClassicAccess()).not.toBe(services.classicAccess)
    expect(defaultSubscription()).not.toBe(services.subscription)
    expect(defaultAppStoreEnvironment()).not.toBe(services.appStoreEnvironment)
    expect(defaultPaywall()).not.toBe(services.paywall)
    expect(defaultNoteFile()).not.toBe(services.noteFile)
    expect(defaultAssetStore()).not.toBe(services.assetStore)
    expect(defaultAttachments()).not.toBe(services.attachments)
    expect(defaultNoteSessions()).not.toBe(services.noteSessions)
    expect(defaultOpenDocuments()).not.toBe(services.openDocuments)
    expect(defaultNoteMove()).not.toBe(services.noteMove)
    expect(defaultTitleRename()).not.toBe(services.titleRename)
    expect(defaultNoteDocuments()).not.toBe(services.noteDocuments)
    expect(defaultNotePreview()).not.toBe(services.notePreview)
    expect(defaultTasks()).not.toBe(services.tasks)
    expect(defaultCalendarEvents()).not.toBe(services.calendarEvents)
    expect(defaultContactSuggestions()).not.toBe(services.contactSuggestions)
    expect(defaultPersonNotes()).not.toBe(services.personNotes)
    expect(defaultMeetings()).not.toBe(services.meetings)
    expect(defaultIndexQuery()).not.toBe(services.indexQuery)
    expect(defaultWikiResolver()).not.toBe(services.wikiResolver)
    expect(defaultBacklinks()).not.toBe(services.backlinks)
    expect(defaultSearch()).not.toBe(services.search)
    expect(defaultSuggestions()).not.toBe(services.suggestions)
    expect(defaultNoteList()).not.toBe(services.noteList)
    expect(defaultGraphStats()).not.toBe(services.graphStats)
    expect(defaultNotePath()).not.toBe(services.notePath)
    expect(defaultNoteLinkResolver()).not.toBe(services.noteLinkResolver)
    expect(defaultNoteCreation()).not.toBe(services.noteCreation)
    expect(defaultPrivacy()).not.toBe(services.privacy)
    expect(() => defaultDialog()).toThrow(/No DialogService/)
    expect(() => defaultClipboard()).toThrow(/No ClipboardService/)
    expect(() => defaultOpener()).toThrow(/No OpenerService/)
    expect(defaultKeymap()).not.toBe(services.keymap)
    expect(defaultCommands()).not.toBe(services.commands)
    expect(defaultNativeMenu()).not.toBe(services.nativeMenu)
  })
})
