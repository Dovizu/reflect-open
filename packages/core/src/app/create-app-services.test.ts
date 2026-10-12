import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defaultIpc } from '../ipc/bridge.ts'
import { createTestClockService } from '../testing/clock.ts'
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
  'mobileStorage',
  'imageCodec',
  'exceptionTelemetry',
  'operations',
  'database',
  'fileChanges',
  'indexStore',
  'update',
  'gitRepository',
  'icloudNative',
  'captureInbox',
  'webFetch',
  'xArchive',
  'audioRecorder',
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

    const mobile = createAppServices({
      ...requiredAdapters(),
      logger: createTestLoggerService(),
      platform: createTestPlatformService({ appPlatform: 'ios' }),
    })
    expect(mobile.haptics).toBeDefined()
    expect(mobile.iap).toBeDefined()
    expect(mobile.appStore).toBeDefined()
    expect(mobile.webAuth).toBeDefined()
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
