import { afterEach, describe, expect, it } from 'vitest'
import { setBridge } from '../ipc/bridge.ts'
import { getAppVersion } from '../ipc/commands.ts'
import {
  createTestAppInfoService,
  createTestIpcBridgeService,
  installTestBridge,
} from '../testing/index.ts'
import {
  createAppInfoService,
  defaultAppInfo,
  marketingVersion,
  setDefaultAppInfo,
} from './app-info-service.ts'

afterEach(() => {
  setDefaultAppInfo(null)
  setBridge(null)
})

describe('createAppInfoService', () => {
  it('reads the version through `app_version`', async () => {
    const ipc = createTestIpcBridgeService({ commands: { app_version: () => '1.2.3' } })

    await expect(createAppInfoService({ ipc }).version()).resolves.toBe('1.2.3')
    expect(ipc.calls()).toEqual([{ command: 'app_version', args: {} }])
  })

  it('rejects a malformed response with a parse error', async () => {
    const ipc = createTestIpcBridgeService({ commands: { app_version: () => 1 } })
    await expect(createAppInfoService({ ipc }).version()).rejects.toMatchObject({
      kind: 'parse',
    })
  })
})

describe('defaultAppInfo', () => {
  it('returns the installed service until it is cleared', () => {
    const fake = createTestAppInfoService()
    setDefaultAppInfo(fake)
    expect(defaultAppInfo()).toBe(fake)

    setDefaultAppInfo(null)
    expect(defaultAppInfo()).not.toBe(fake)
    expect(defaultAppInfo()).toBe(defaultAppInfo())
  })

  it('uses the bridge installed at call time', async () => {
    installTestBridge(createTestIpcBridgeService({ commands: { app_version: () => '2.0.0' } }))
    await expect(defaultAppInfo().version()).resolves.toBe('2.0.0')
  })

  it('backs `getAppVersion`', async () => {
    setDefaultAppInfo(createTestAppInfoService('3.1.4'))
    await expect(getAppVersion()).resolves.toBe('3.1.4')
  })
})

describe('createTestAppInfoService', () => {
  it('reports a test version by default', async () => {
    await expect(createTestAppInfoService().version()).resolves.toBe('0.0.0-test')
  })

  it('reports the given version', async () => {
    await expect(createTestAppInfoService('1.0.0').version()).resolves.toBe('1.0.0')
  })
})

describe('marketingVersion', () => {
  it('strips the prerelease tag', () => {
    expect(marketingVersion('0.6.0-beta.6')).toBe('0.6.0')
  })

  it('strips build metadata', () => {
    expect(marketingVersion('0.6.0+20260711')).toBe('0.6.0')
  })

  it('keeps a stable version unchanged', () => {
    expect(marketingVersion('0.6.0')).toBe('0.6.0')
  })
})
