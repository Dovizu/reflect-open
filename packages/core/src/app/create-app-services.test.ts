import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseSearchQuery } from '../indexing/filter-query.ts'
import { defaultIpc } from '../ipc/bridge.ts'
import { createTestClockService } from '../testing/clock.ts'
import { createTestDatabaseService, seedNotes } from '../testing/database.ts'
import { createTestHttpService } from '../testing/http.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestPlatformService } from '../testing/platform.ts'
import { createTestAppServices, installTestServices } from '../testing/services.ts'
import { createTestClipboardService, createTestDialogService } from '../testing/shell.ts'
import { createTestUpdaterAdapter } from '../testing/update.ts'
import { defaultClock } from './clock-service.ts'
import { createAppServices, type AppAdapters, type AppServices } from './create-app-services.ts'
import { defaultLogger } from './logger-service.ts'
import { createDetachedLifecycleDom } from './lifecycle-service.ts'
import { createPosixPathTransport } from './path-service.ts'
import { defaultPlatform } from './platform-service.ts'
import { createSingleWindowHost } from './window-service.ts'

const SERVICE_KEYS = [
  'ipc',
  'logger',
  'clock',
  'id',
  'hash',
  'platform',
  'storage',
  'http',
  'dialog',
  'clipboard',
  'opener',
  'path',
  'window',
  'lifecycle',
  'secretStore',
  'appInfo',
  'calendar',
  'contacts',
  'agentSkill',
  'mobileOnboarding',
  'mobileStorage',
  'imageCodec',
  'indexLifecycle',
  'graphSession',
  'exceptionTelemetry',
  'operations',
  'settings',
  'theme',
  'persistenceFlush',
  'database',
  'fileChanges',
  'indexStore',
  'embeddingIndex',
  'embeddingRuntime',
  'chatHistory',
  'update',
  'navigation',
  'deepLink',
  'gitRepository',
  'githubAuth',
  'gitHostCredentials',
  'githubRepos',
  'gists',
  'syncEngines',
  'backups',
  'icloudNative',
  'captureInbox',
  'webFetch',
  'xArchive',
  'audioRecorder',
  'classicAccess',
  'noteFile',
  'assetStore',
  'attachments',
  'noteSessions',
  'openDocuments',
  'noteMove',
  'titleRename',
  'noteDocuments',
  'tasks',
  'noteActions',
  'noteRows',
  'indexQuery',
  'wikiResolver',
  'backlinks',
  'search',
  'suggestions',
  'noteList',
  'graphStats',
  'notePath',
  'noteLinkResolver',
  'noteCreation',
  'privacy',
  'retrieval',
  'aiCredentials',
  'aiKeyValidation',
  'keyboard',
  'share',
  'languageModel',
  'aiPrompts',
  'keymap',
  'commands',
  'nativeMenu',
  'aiProviderConfig',
  'selectionTransform',
  'semanticSearch',
  'pageDescriber',
  'assetDescriber',
  'transcription',
  'transcriptEnrichment',
  'noteTools',
  'chatEngine',
  'chatGraphContext',
  'chatSessions',
  'backlinkTarget',
  'capture',
] as const satisfies readonly (keyof AppServices)[]

function requiredAdapters(): AppAdapters {
  const ipc = createTestIpcBridgeService({ commands: { app_version: () => '1.2.3' } })
  return {
    ipc: ipc.transport,
    platform: createTestPlatformService(),
    http: createTestHttpService(),
    storage: { local: null, session: null },
    dialog: createTestDialogService(),
    clipboard: createTestClipboardService(),
    opener: { openUrl: async () => {}, revealItemInDir: async () => {} },
    path: createPosixPathTransport('/home/test'),
    window: createSingleWindowHost(),
    lifecycle: createDetachedLifecycleDom(),
  }
}

function setup() {
  const adapters: AppAdapters = {
    ...requiredAdapters(),
    logger: createTestLoggerService(),
    clock: createTestClockService({ now: 5 }),
  }
  return { adapters, services: createAppServices(adapters) }
}

let restore: (() => void) | null = null

afterEach(() => {
  restore?.()
  restore = null
})

describe('createAppServices', () => {
  it('composes every app service', () => {
    const { services } = setup()
    expect(Object.keys(services).toSorted()).toEqual([...SERVICE_KEYS].toSorted())
    for (const key of SERVICE_KEYS) {
      expect(services[key], key).toBeDefined()
    }
  })

  it('passes the given services through and builds the rest over the adapters', async () => {
    const { adapters, services } = setup()
    expect(services.logger).toBe(adapters.logger)
    expect(services.clock).toBe(adapters.clock)
    expect(services.http).toBe(adapters.http)
    expect(services.dialog).toBe(adapters.dialog)
    expect(services.clipboard).toBe(adapters.clipboard)
    expect(services.ipc.transport).toBe(adapters.ipc)
    await expect(services.ipc.call('app_version', {}, z.string())).resolves.toBe('1.2.3')
    expect(services.platform.appVersion).toBe('0.0.0-test')
    await expect(services.path.homeDir()).resolves.toBe('/home/test')
    expect(services.window.isMainWindow()).toBe(true)
  })

  it('supports updates only with an updater adapter', () => {
    expect(createAppServices(requiredAdapters()).update.supported).toBe(false)
    const services = createAppServices({
      ...requiredAdapters(),
      updater: createTestUpdaterAdapter(),
    })
    expect(services.update.supported).toBe(true)
  })

  it('defaults the logger, clock, id, and hash', () => {
    const services = createAppServices(requiredAdapters())
    expect(services.clock.now()).toBeGreaterThan(5)
    expect(services.id.noteId()).toMatch(/^[0-9a-z]{26}$/)
    expect(typeof services.logger.warn).toBe('function')
  })

  it('composes the plugin services and the native recorder on mobile only', () => {
    const desktop = createAppServices({ ...requiredAdapters(), logger: createTestLoggerService() })
    expect(desktop.haptics).toBeUndefined()
    expect(desktop.iap).toBeUndefined()
    expect(desktop.appStore).toBeUndefined()
    expect(desktop.webAuth).toBeUndefined()
    expect(desktop.subscription).toBeUndefined()
    expect(desktop.appStoreEnvironment).toBeUndefined()
    expect(desktop.paywall).toBeUndefined()
    expect(desktop.classicAccess).toBeDefined()

    const mobile = createAppServices({
      ...requiredAdapters(),
      logger: createTestLoggerService(),
      platform: createTestPlatformService({ appPlatform: 'ios' }),
    })
    expect(mobile.haptics).toBeDefined()
    expect(mobile.iap).toBeDefined()
    expect(mobile.appStore).toBeDefined()
    expect(mobile.webAuth).toBeDefined()
    expect(mobile.subscription).toBeDefined()
    expect(mobile.appStoreEnvironment).toBeDefined()
    expect(mobile.paywall).toBeDefined()
    // Only the native recorder is supported without `MediaRecorder`.
    expect(mobile.audioRecorder.isSupported()).toBe(true)
  })

  it('echoes own writes onto the file-change stream on mobile only', () => {
    for (const [appPlatform, echoed] of [
      ['desktop', 0],
      ['ios', 1],
    ] as const) {
      const services = createAppServices({
        ...requiredAdapters(),
        logger: createTestLoggerService(),
        platform: createTestPlatformService({ appPlatform }),
      })
      let batches = 0
      services.fileChanges.subscribe(() => {
        batches++
      })
      services.fileChanges.reportOwnWrite([{ path: 'notes/a.md', kind: 'upsert' }])
      expect(batches, appPlatform).toBe(echoed)
    }
  })

  it('reports note and asset writes to the composed file-change service', async () => {
    const ipc = createTestIpcBridgeService({
      commands: { note_write: () => null, asset_write: () => null },
    })
    const services = createAppServices({
      ...requiredAdapters(),
      ipc: ipc.transport,
      logger: createTestLoggerService(),
      clock: createTestClockService({ now: 5 }),
    })
    const written: string[] = []
    services.fileChanges.subscribeOwnWrites((paths) => {
      written.push(...paths)
    })
    await expect(services.noteFile.write('notes/a.md', 'a', 1)).resolves.toBe(5)
    await services.assetStore.writeBase64('assets/a.png', 'AA==', 1)
    expect(written).toEqual(['notes/a.md', 'assets/a.png'])
  })

  it('builds the index reads over the composed database', async () => {
    const ipc = createTestIpcBridgeService({
      commands: { db_query: () => [{ path: 'notes/a.md' }] },
    })
    const services = createAppServices({
      ...requiredAdapters(),
      ipc: ipc.transport,
      logger: createTestLoggerService(),
    })
    await expect(services.indexQuery.randomNotePath()).resolves.toBe('notes/a.md')
    expect(ipc.calls().map((call) => call.command)).toEqual(['db_query'])
  })

  it('leaves every process-wide default alone', () => {
    const installed = createTestAppServices()
    restore = installTestServices(installed)
    setup()
    expect(defaultLogger()).toBe(installed.logger)
    expect(defaultClock()).toBe(installed.clock)
    expect(defaultPlatform()).toBe(installed.platform)
    expect(defaultIpc()).toBe(installed.ipc)
  })
})

describe('createTestAppServices', () => {
  it('builds the index reads over the test database and note files', async () => {
    const services = createTestAppServices()
    seedNotes(services.database, [{ path: 'notes/plan.md', markdown: '# Plan\n' }])
    await services.noteFile.write('notes/plan-2.md', '# Plan\n', 1)

    await expect(services.indexQuery.resolveNoteTarget('plan')).resolves.toBe('notes/plan.md')
    await expect(
      services.search.searchWithFilters(parseSearchQuery('plan')),
    ).resolves.toMatchObject([{ path: 'notes/plan.md' }])
    await expect(services.notePath.slugPathForTitle('notes/new.md', 'Plan')).resolves.toBe(
      'notes/plan-3.md',
    )
  })

  it('builds the index reads over an overriding database', async () => {
    const database = createTestDatabaseService()
    seedNotes(database, [{ path: 'notes/other.md', markdown: '# Other\n' }])
    const services = createTestAppServices({ database })

    await expect(services.indexQuery.resolveNoteTarget('other')).resolves.toBe('notes/other.md')
  })
})
