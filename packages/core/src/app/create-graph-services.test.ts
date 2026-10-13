import { describe, expect, it } from 'vitest'
import type { ChatSession } from '../ai/chat/chat-session-service.ts'
import type { ICloudDownloadServiceOptions } from '../sync/icloud-download-service.ts'
import type { ICloudSyncServiceOptions } from '../sync/icloud-sync-service.ts'
import type { TestPlatformOptions } from '../testing/platform.ts'
import { createTestPlatformService } from '../testing/platform.ts'
import { createTestAppServices } from '../testing/services.ts'
import {
  createTestICloudSyncService,
  createTestScriptedBackupServiceFactory,
  type TestICloudSyncService,
} from '../testing/sync.ts'
import { createGraphServices } from './create-graph-services.ts'
import { createGraphSession, type GraphRole } from './graph-session.ts'

const ICLOUD_ROOT = '/Users/me/Library/Mobile Documents/iCloud~reflect/Documents/notes'

interface SetupOptions {
  role?: GraphRole
  root?: string
  indexGeneration?: number | null
  platform?: TestPlatformOptions
}

/** One graph session's services over recording doubles. */
function setup(options?: SetupOptions) {
  const app = createTestAppServices({ platform: createTestPlatformService(options?.platform) })
  const controller = new AbortController()
  const session = createGraphSession(
    {
      root: options?.root ?? '/g',
      name: 'g',
      generation: 3,
      indexGeneration: options?.indexGeneration === undefined ? 5 : options.indexGeneration,
    },
    controller.signal,
  )
  const backups = createTestScriptedBackupServiceFactory()
  const chats: { attached: number; detached: number }[] = []
  const icloudSyncs: { options: ICloudSyncServiceOptions; service: TestICloudSyncService }[] = []
  const downloads: { options: ICloudDownloadServiceOptions; calls: string[] }[] = []
  const graph = createGraphServices(app, session, options?.role ?? 'main', {
    backups,
    icloudSyncs: {
      create: (syncOptions) => {
        const service = createTestICloudSyncService()
        icloudSyncs.push({ options: syncOptions, service })
        return service
      },
    },
    icloudDownloads: {
      create: (downloadOptions) => {
        const calls: string[] = []
        downloads.push({ options: downloadOptions, calls })
        return {
          start: () => {
            calls.push('start')
          },
          dispose: () => {
            calls.push('dispose')
          },
        }
      },
    },
    capture: app.capture,
    assetDescription: app.assetDescription,
    chatSessions: {
      create: (chatOptions) => {
        const chat = app.chatSessions.create(chatOptions)
        const record = { attached: 0, detached: 0 }
        chats.push(record)
        return {
          ...chat,
          attach: () => {
            record.attached += 1
            return () => {
              record.detached += 1
            }
          },
        } satisfies ChatSession
      },
    },
    attachments: app.attachments,
    settings: app.settings,
    mobileOnboarding: app.mobileOnboarding,
    graphSession: app.graphSession,
    platform: app.platform,
  })
  return { app, controller, session, graph, backups, chats, icloudSyncs, downloads }
}

describe('createGraphServices', () => {
  it('holds the app services, the session, and the role', () => {
    const { app, session, graph } = setup({ role: 'note-window' })
    expect(graph).toMatchObject({ app, session, role: 'note-window' })
  })

  it('starts every lifecycle of the main window over the session generations', async () => {
    const context = setup()
    await context.app.settings.whenLoaded()

    expect(context.graph.backup).toBe(context.backups.backup)
    expect(context.backups.creations()).toEqual([{ generation: 3, indexGeneration: 5 }])
    expect(context.backups.backup.calls()).toEqual([{ method: 'start' }])
    expect(context.chats).toEqual([{ attached: 1, detached: 0 }])
    expect(context.app.attachments.watchers()).toBe(1)
    expect(context.app.capture.sessions()).toEqual([
      { generation: 3, starts: 1, schedules: 0, disposed: false },
    ])
    expect(context.app.assetDescription.sessions()).toEqual([
      { generation: 3, starts: 1, schedules: 0, disposed: false },
    ])
    expect(context.icloudSyncs).toEqual([])
    expect(context.downloads).toEqual([])
  })

  it('runs every lifecycle of a graph whose index failed to open, until the session ends', () => {
    const context = setup({ root: ICLOUD_ROOT, indexGeneration: null })

    expect(context.backups.creations()).toEqual([{ generation: 3, indexGeneration: null }])
    expect(context.icloudSyncs.map((sync) => sync.options.indexGeneration)).toEqual([null])
    expect(context.app.capture.sessions()).toHaveLength(1)
    expect(context.app.attachments.watchers()).toBe(1)
    expect(context.chats).toEqual([{ attached: 1, detached: 0 }])

    context.controller.abort()
    expect(context.backups.backup.calls().at(-1)).toEqual({ method: 'dispose' })
    expect(context.icloudSyncs[0]?.service.calls()).toEqual(['start', 'dispose'])
    expect(context.app.capture.sessions()[0]?.disposed).toBe(true)
    expect(context.app.attachments.watchers()).toBe(0)
    expect(context.chats).toEqual([{ attached: 1, detached: 1 }])
  })

  it('runs only the chat session and the catalog watch in a note window', () => {
    const context = setup({ role: 'note-window', root: ICLOUD_ROOT })

    expect(context.graph.backup).toBeNull()
    expect(context.backups.creations()).toEqual([])
    expect(context.chats).toEqual([{ attached: 1, detached: 0 }])
    expect(context.app.attachments.watchers()).toBe(1)
    expect(context.app.capture.sessions()).toEqual([])
    expect(context.app.assetDescription.sessions()).toEqual([])
    expect(context.icloudSyncs).toEqual([])
  })

  it('disposes every lifecycle when the session ends', () => {
    const context = setup({ root: ICLOUD_ROOT })
    context.controller.abort()

    expect(context.backups.backup.calls().at(-1)).toEqual({ method: 'dispose' })
    expect(context.chats).toEqual([{ attached: 1, detached: 1 }])
    expect(context.app.attachments.watchers()).toBe(0)
    expect(context.app.capture.sessions()[0]?.disposed).toBe(true)
    expect(context.app.assetDescription.sessions()[0]?.disposed).toBe(true)
    expect(context.icloudSyncs[0]?.service.calls()).toEqual(['start', 'dispose'])
  })

  it('runs the iCloud conflict lifecycle for an iCloud root, with the watch on mobile', () => {
    const desktop = setup({ root: ICLOUD_ROOT })
    expect(desktop.icloudSyncs.map((sync) => sync.options)).toEqual([
      { root: ICLOUD_ROOT, generation: 3, indexGeneration: 5, metadataWatch: false },
    ])

    const mobile = setup({
      root: ICLOUD_ROOT,
      platform: { appPlatform: 'ios', surface: { mobileApp: true, touchEditor: true } },
    })
    expect(mobile.icloudSyncs.map((sync) => sync.options.metadataWatch)).toEqual([true])
  })

  it('opens and disposes the asset description session as `describeAssets` flips', () => {
    const context = setup()
    const sessions = () => context.app.assetDescription.sessions()
    expect(sessions().map((session) => session.disposed)).toEqual([false])

    context.app.settings.update({ describeAssets: false })
    expect(sessions().map((session) => session.disposed)).toEqual([true])

    context.app.settings.update({ describeAssets: true })
    expect(sessions().map((session) => session.disposed)).toEqual([true, false])

    context.controller.abort()
    expect(sessions().map((session) => session.disposed)).toEqual([true, true])
    context.app.settings.update({ describeAssets: false })
    context.app.settings.update({ describeAssets: true })
    expect(sessions()).toHaveLength(2)
  })

  it('describes no assets on mobile', () => {
    const context = setup({ platform: { appPlatform: 'ios' } })
    expect(context.app.assetDescription.sessions()).toEqual([])
  })

  it('refreshes downloads while the mobile graph is stored in iCloud', () => {
    const context = setup({ root: ICLOUD_ROOT, platform: { appPlatform: 'ios' } })
    expect(context.downloads).toEqual([])

    context.app.mobileOnboarding.setState({ kind: 'icloud' })
    expect(context.downloads.map((download) => download.options.root)).toEqual([ICLOUD_ROOT])
    expect(context.downloads[0]?.options.refreshIndex).toBe(context.app.graphSession.refreshIndex)
    expect(context.downloads[0]?.calls).toEqual(['start'])

    context.controller.abort()
    expect(context.downloads[0]?.calls).toEqual(['start', 'dispose'])
  })

  it('leaves nothing running for a session that already ended', () => {
    const app = createTestAppServices()
    const controller = new AbortController()
    controller.abort()
    const session = createGraphSession(
      { root: '/g', name: 'g', generation: 3, indexGeneration: 5 },
      controller.signal,
    )
    const backups = createTestScriptedBackupServiceFactory()
    createGraphServices(app, session, 'main', {
      backups,
      icloudSyncs: app.icloudSyncs,
      icloudDownloads: app.icloudDownloads,
      capture: app.capture,
      assetDescription: app.assetDescription,
      chatSessions: app.chatSessions,
      attachments: app.attachments,
      settings: app.settings,
      mobileOnboarding: app.mobileOnboarding,
      graphSession: app.graphSession,
      platform: app.platform,
    })

    expect(backups.backup.calls()).toEqual([{ method: 'start' }, { method: 'dispose' }])
    expect(app.attachments.watchers()).toBe(0)
    expect(app.capture.sessions()[0]?.disposed).toBe(true)
  })
})
