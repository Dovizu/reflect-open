import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defaultIpc, setBridge } from './bridge.ts'
import { call, callBinary } from './invoke.ts'

afterEach(() => {
  setBridge(null)
})

describe('call', () => {
  it('delegates to the service over the installed bridge', async () => {
    const invoke = vi.fn().mockResolvedValue({ root: '/g' })
    setBridge({ invoke, listen: async () => () => {} })

    await expect(
      call('graph_open', { path: '/g' }, z.object({ root: z.string() })),
    ).resolves.toEqual({ root: '/g' })
    expect(invoke).toHaveBeenCalledWith('graph_open', { path: '/g' })
  })

  it('fails loudly when no bridge is installed', async () => {
    await expect(call('anything', {}, z.unknown())).rejects.toThrow(/no ipc bridge/i)
  })
})

describe('callBinary', () => {
  it('delegates to the service over the installed bridge', async () => {
    const invokeBinary = vi.fn().mockResolvedValue(null)
    setBridge({ invoke: async () => null, listen: async () => () => {}, invokeBinary })

    const body = new Uint8Array([1])
    await expect(callBinary('asset_write', body, { path: 'a' }, z.null())).resolves.toBeNull()
    expect(invokeBinary).toHaveBeenCalledWith('asset_write', body, { path: 'a' })
  })
})

describe('defaultIpc', () => {
  it('throws when no bridge is installed', () => {
    expect(() => defaultIpc()).toThrow(/no ipc bridge/i)
  })

  it('is rebuilt when the bridge is replaced', () => {
    setBridge({ invoke: async () => null, listen: async () => () => {} })
    const first = defaultIpc()
    expect(first.hasBinaryTransport).toBe(false)

    setBridge({
      invoke: async () => null,
      listen: async () => () => {},
      invokeBinary: async () => null,
    })
    expect(defaultIpc()).not.toBe(first)
    expect(defaultIpc().hasBinaryTransport).toBe(true)
  })
})
