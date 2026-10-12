import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { currentIpc, defaultIpc, getBridge, hasBridge, setBridge, setDefaultIpc } from './bridge.ts'

afterEach(() => {
  setBridge(null)
})

describe('currentIpc', () => {
  it('forwards each call to the bridge installed at call time', async () => {
    const ipc = currentIpc()
    const first = createTestIpcBridgeService({ commands: { app_version: () => '1' } })
    const second = createTestIpcBridgeService({ commands: { app_version: () => '2' } })

    setBridge(first.transport)
    await expect(ipc.call('app_version', {}, z.string())).resolves.toBe('1')
    setBridge(second.transport)
    await expect(ipc.call('app_version', {}, z.string())).resolves.toBe('2')
  })

  it('rejects instead of throwing while no bridge is installed', async () => {
    await expect(currentIpc().call('app_version', {}, z.string())).rejects.toThrow(
      /No IPC bridge is installed/,
    )
    await expect(currentIpc().listen('index:written', () => {})).rejects.toThrow(
      /No IPC bridge is installed/,
    )
  })

  it('reports the capabilities of the installed bridge', () => {
    const ipc = currentIpc()
    expect(ipc.hasBinaryTransport).toBe(false)
    expect(ipc.hasPluginEvents).toBe(false)
    setBridge(createTestIpcBridgeService().transport)
    expect(ipc.hasBinaryTransport).toBe(true)
    expect(ipc.hasPluginEvents).toBe(true)
  })
})

describe('setDefaultIpc', () => {
  it('installs the service itself and its transport as the bridge', () => {
    const service = createTestIpcBridgeService()
    setDefaultIpc(service)
    expect(defaultIpc()).toBe(service)
    expect(getBridge()).toBe(service.transport)
    setDefaultIpc(null)
    expect(hasBridge()).toBe(false)
  })
})
