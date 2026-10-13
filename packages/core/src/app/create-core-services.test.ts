import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseSearchQuery } from '../indexing/filter-query.ts'
import { createTestClockService } from '../testing/clock.ts'
import { createTestDatabaseService, seedNotes } from '../testing/database.ts'
import { createTestNoteFileService } from '../testing/graph.ts'
import { createTestHttpService } from '../testing/http.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestPlatformService } from '../testing/platform.ts'
import { createTestCoreServices } from '../testing/services.ts'
import { createTestClipboardService, createTestDialogService } from '../testing/shell.ts'
import { createNoteDocumentService } from '../documents/note-document-service.ts'
import {
  composeCoreServices,
  createCoreServices,
  type CoreAdapters,
  type CoreServices,
} from './create-core-services.ts'
import { createDetachedLifecycleDom } from './lifecycle-service.ts'
import { createPosixPathTransport } from './path-service.ts'
import { createSingleWindowHost } from './window-service.ts'

const SERVICE_KEYS = [
  'ipc',
  'logger',
  'clock',
  'id',
  'hash',
  'platform',
  'storage',
  'dialog',
  'clipboard',
  'opener',
  'path',
  'window',
  'lifecycle',
  'appInfo',
  'calendar',
  'contacts',
  'contactSuggestions',
  'meetings',
  'agentSkill',
  'mobileOnboarding',
  'mobileStorage',
  'imageCodec',
  'indexLifecycle',
  'graphSession',
  'operations',
  'settings',
  'persistenceFlush',
  'fileChanges',
  'embeddingRuntime',
  'chatHistory',
  'captureInbox',
  'wikiResolver',
  'noteLinkResolver',
  'githubAuth',
  'gistPublish',
  'icloudNative',
  'icloudMigration',
  'conflictResolution',
  'embedMedia',
  'linkPreview',
  'audioMemo',
  'classicAccess',
  'attachments',
  'noteSessions',
  'openDocuments',
  'noteMove',
  'titleRename',
  'noteDocuments',
  'tasks',
  'noteActions',
  'noteRows',
  'dailyNotes',
  'templates',
  'indexQuery',
  'backlinks',
  'search',
  'noteList',
  'notePath',
  'notePreview',
  'noteCreation',
  'aiPrompts',
  'aiProviderConfig',
  'selectionTransform',
  'semanticSearch',
  'chatSessions',
  'capture',
  'assetDescription',
  'personNotes',
  'suggestions',
  'retrieval',
  'mobile',
] as const satisfies readonly (keyof CoreServices)[]

function requiredAdapters(): CoreAdapters {
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
  const adapters: CoreAdapters = {
    ...requiredAdapters(),
    logger: createTestLoggerService(),
    clock: createTestClockService({ now: 5 }),
  }
  return { adapters, services: createCoreServices(adapters) }
}

describe('createCoreServices', () => {
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
    expect(services.dialog).toBe(adapters.dialog)
    expect(services.clipboard).toBe(adapters.clipboard)
    await expect(services.ipc.call('app_version', {}, z.string())).resolves.toBe('1.2.3')
    expect(services.platform.appVersion).toBe('0.0.0-test')
    await expect(services.path.homeDir()).resolves.toBe('/home/test')
    expect(services.window.isMainWindow()).toBe(true)
  })

  it('defaults the logger, clock, id, and hash', () => {
    const services = createCoreServices(requiredAdapters())
    expect(services.clock.now()).toBeGreaterThan(5)
    expect(services.id.noteId()).toMatch(/^[0-9a-z]{26}$/)
    expect(typeof services.logger.warn).toBe('function')
  })

  it('composes the mobile services on mobile only', () => {
    const desktop = createCoreServices({ ...requiredAdapters(), logger: createTestLoggerService() })
    expect(desktop.mobile).toBeNull()
    expect(desktop.audioMemo).toBeDefined()
    expect(desktop.classicAccess).toBeDefined()

    const mobile = createCoreServices({
      ...requiredAdapters(),
      logger: createTestLoggerService(),
      platform: createTestPlatformService({ appPlatform: 'ios' }),
    })
    expect(mobile.mobile?.haptics).toBeDefined()
    expect(mobile.mobile?.subscription).toBeDefined()
    expect(mobile.mobile?.appStoreEnvironment).toBeDefined()
    expect(mobile.mobile?.paywall).toBeDefined()
    expect(mobile.mobile?.mobileAudioMemo).toBeDefined()
  })

  it('echoes own writes onto the file-change stream on mobile only', () => {
    for (const [appPlatform, echoed] of [
      ['desktop', 0],
      ['ios', 1],
    ] as const) {
      const services = createCoreServices({
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

  it('reports note writes to the composed file-change service', async () => {
    const ipc = createTestIpcBridgeService({
      commands: { note_write: () => null },
    })
    const { services, internal } = composeCoreServices({
      ...requiredAdapters(),
      ipc: ipc.transport,
      logger: createTestLoggerService(),
      clock: createTestClockService({ now: 5 }),
    })
    const written: string[] = []
    services.fileChanges.subscribeOwnWrites((paths) => {
      written.push(...paths)
    })
    await expect(internal.noteFile.write('notes/a.md', 'a', 1)).resolves.toBe(5)
    expect(written).toEqual(['notes/a.md'])
  })

  it('builds the index reads over the composed database', async () => {
    const ipc = createTestIpcBridgeService({
      commands: { db_query: () => [{ path: 'notes/a.md' }] },
    })
    const services = createCoreServices({
      ...requiredAdapters(),
      ipc: ipc.transport,
      logger: createTestLoggerService(),
    })
    await expect(services.indexQuery.randomNotePath()).resolves.toBe('notes/a.md')
    expect(ipc.calls().map((call) => call.command)).toEqual(['db_query'])
  })

  it('builds each replaced service with its factory over the same dependencies', () => {
    const noteFile = createTestNoteFileService()
    const received: unknown[] = []
    const { internal } = composeCoreServices(requiredAdapters(), {
      noteFile: () => noteFile,
      noteDocuments: (deps) => {
        received.push(deps.noteFile)
        return createNoteDocumentService(deps)
      },
    })
    expect(internal.noteFile).toBe(noteFile)
    expect(received).toEqual([noteFile])
  })
})

describe('createTestCoreServices', () => {
  it('builds the index reads over the test database and note files', async () => {
    const services = createTestCoreServices()
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
    const services = createTestCoreServices({ database })

    await expect(services.indexQuery.resolveNoteTarget('other')).resolves.toBe('notes/other.md')
  })
})
