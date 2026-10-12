import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBridge } from './ipc/bridge.ts'
import { createLogger, errorField } from './log.ts'

describe('createLogger', () => {
  beforeEach(() => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation(() => {})
    }
  })

  afterEach(() => {
    setBridge(null)
    vi.restoreAllMocks()
  })

  it('writes to the console and stays silent on the bridge when none is installed', () => {
    const log = createLogger('embeddings')
    log.info('backfill finished', { notes: 3, elapsedMs: 12 })
    log.warn('plain line')
    expect(console.info).toHaveBeenCalledWith('[embeddings] backfill finished', {
      notes: 3,
      elapsedMs: 12,
    })
    expect(console.warn).toHaveBeenCalledWith('[embeddings] plain line')
  })

  it('forwards every line to the log plugin with compacted fields', async () => {
    const invoke = vi.fn(async () => null)
    setBridge({ invoke, listen: async () => () => {} })
    const log = createLogger('indexing')
    log.error('apply failed', { path: 'a.md', retries: undefined, ok: false })
    log.debug('no fields')
    await Promise.resolve()
    expect(invoke).toHaveBeenNthCalledWith(1, 'plugin:log|log', {
      level: 5,
      message: 'apply failed {"path":"a.md","ok":false}',
      location: 'indexing',
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin:log|log', {
      level: 2,
      message: 'no fields',
      location: 'indexing',
    })
  })

  it('swallows a failing forward instead of throwing or recursing', async () => {
    const invoke = vi.fn(async () => {
      throw new Error('ipc down')
    })
    setBridge({ invoke, listen: async () => () => {} })
    const log = createLogger('sync')
    expect(() => log.info('still fine')).not.toThrow()
    await Promise.resolve()
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('errorField names the cause through errorMessage', () => {
    expect(errorField(new Error('boom'))).toEqual({ error: 'boom' })
  })
})
