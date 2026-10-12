import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { hasBridge, setBridge } from '../ipc/bridge.ts'
import { call } from '../ipc/invoke.ts'
import { createTestIpcBridgeService, installTestBridge } from './ipc.ts'

afterEach(() => {
  setBridge(null)
})

describe('createTestIpcBridgeService', () => {
  it('answers commands from the constructor table and onCommand', async () => {
    const ipc = createTestIpcBridgeService({ commands: { app_version: () => '1.0.0' } })
    ipc.onCommand('note_exists', async (args) => args.path === 'a.md')

    await expect(ipc.call('app_version', {}, z.string())).resolves.toBe('1.0.0')
    await expect(ipc.call('note_exists', { path: 'a.md' }, z.boolean())).resolves.toBe(true)
  })

  it('answers binary commands from onBinaryCommand', async () => {
    const ipc = createTestIpcBridgeService()
    ipc.onBinaryCommand('asset_write', (body, headers) => ({
      size: body.length,
      path: headers.path,
    }))

    await expect(
      ipc.callBinary(
        'asset_write',
        new Uint8Array([1, 2]),
        { path: 'a.png' },
        z.object({ size: z.number(), path: z.string() }),
      ),
    ).resolves.toEqual({ size: 2, path: 'a.png' })
  })

  it('rejects an unknown command with an unknown AppError naming it', async () => {
    const ipc = createTestIpcBridgeService()

    const error = await ipc.call('nope', {}, z.unknown()).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ kind: 'unknown' })
    expect(error).toHaveProperty('message', expect.stringContaining('nope'))
  })

  it('records every call in order', async () => {
    const ipc = createTestIpcBridgeService({ commands: { a: () => null } })
    await ipc.call('a', { x: 1 }, z.null())
    await ipc.call('b', {}, z.unknown()).catch(() => {})

    expect(ipc.calls()).toEqual([
      { command: 'a', args: { x: 1 } },
      { command: 'b', args: {} },
    ])
  })

  it('emits events to listeners until they unlisten', async () => {
    const ipc = createTestIpcBridgeService()
    const handler = vi.fn()
    const unlisten = await ipc.listen('fs:changed', handler)

    ipc.emit('fs:changed', { paths: ['a.md'] })
    unlisten()
    ipc.emit('fs:changed', { paths: ['b.md'] })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ paths: ['a.md'] })
  })

  it('emits plugin events to validated subscribers', async () => {
    const ipc = createTestIpcBridgeService()
    const seen: number[] = []
    const subscription = ipc.subscribePlugin('demo', 'tick', z.number(), (n) => {
      seen.push(n)
    })
    await subscription.ready

    ipc.emitPlugin('demo', 'tick', 1)
    ipc.emitPlugin('demo', 'tick', 2)
    expect(seen).toEqual([1, 2])
  })

  it('can omit the binary and plugin-event transports', () => {
    const ipc = createTestIpcBridgeService({ binary: false, pluginEvents: false })
    expect(ipc.hasBinaryTransport).toBe(false)
    expect(ipc.hasPluginEvents).toBe(false)
  })
})

describe('installTestBridge', () => {
  it('installs the fake as the process-wide bridge until uninstalled', async () => {
    const ipc = createTestIpcBridgeService({ commands: { ping: () => 'pong' } })
    const uninstall = installTestBridge(ipc)

    await expect(call('ping', {}, z.string())).resolves.toBe('pong')
    uninstall()
    expect(hasBridge()).toBe(false)
  })
})
