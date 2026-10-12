import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestEmbeddingRuntimeService } from '../testing/embeddings.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { embedEnsure, embedStatus, embedTexts, subscribeEmbedStatus } from './commands.ts'
import {
  createEmbeddingRuntimeService,
  defaultEmbeddingRuntime,
  setDefaultEmbeddingRuntime,
  type EmbedStatus,
} from './embedding-runtime-service.ts'

const READY: EmbedStatus = { status: 'ready', model: 'all-MiniLM-L6-v2' }
const LOADING: EmbedStatus = { status: 'loading' }

function setup() {
  const ipc = createTestIpcBridgeService()
  const logger = createTestLoggerService()
  const runtime = createEmbeddingRuntimeService({ ipc, logger })
  return { ipc, logger, runtime }
}

afterEach(() => {
  setDefaultEmbeddingRuntime(null)
})

describe('createEmbeddingRuntimeService', () => {
  it('polls, loads and embeds over the runtime commands', async () => {
    const { ipc, runtime } = setup()
    ipc.onCommand('embed_status', () => ({ status: 'uninitialized' }))
    ipc.onCommand('embed_ensure', () => READY)
    ipc.onCommand('embed_texts', () => [[0.5, 0.5]])

    await expect(runtime.status()).resolves.toEqual({ status: 'uninitialized' })
    await expect(runtime.ensure()).resolves.toEqual(READY)
    await expect(runtime.embedTexts(['hello'])).resolves.toEqual([[0.5, 0.5]])
    expect(ipc.calls().at(-1)).toEqual({ command: 'embed_texts', args: { texts: ['hello'] } })
  })

  it('remembers the last observed status and notifies subscribers', async () => {
    const { ipc, runtime } = setup()
    ipc.onCommand('embed_status', () => LOADING)
    expect(runtime.lastStatus()).toEqual({ status: 'uninitialized' })

    const seen: EmbedStatus[] = []
    const unlisten = runtime.subscribe((status) => {
      seen.push(status)
    })
    await runtime.status()
    ipc.emit('embed:status', READY)
    unlisten()
    ipc.emit('embed:status', { status: 'failed', message: 'offline' })

    expect(seen).toEqual([LOADING, READY])
    expect(runtime.lastStatus()).toEqual(READY)
  })

  it('logs an invalid status event', () => {
    const { ipc, logger, runtime } = setup()
    runtime.subscribe(() => {})
    ipc.emit('embed:status', { status: 'mystery' })

    expect(runtime.lastStatus()).toEqual({ status: 'uninitialized' })
    expect(logger.getErrors()).toHaveLength(1)
  })

  it('logs a failed event subscription', async () => {
    const { ipc, logger } = setup()
    const runtime = createEmbeddingRuntimeService({
      ipc: {
        ...ipc,
        listen: async () => {
          throw new Error('no events')
        },
      },
      logger,
    })
    runtime.subscribe(() => {})
    await vi.waitFor(() => expect(logger.getWarnings()).toHaveLength(1))
  })

  describe('awaitTerminalStatus', () => {
    it('resolves a terminal status at once', async () => {
      const { runtime } = setup()
      await expect(runtime.awaitTerminalStatus({ status: 'unsupported' })).resolves.toEqual({
        status: 'unsupported',
      })
    })

    it('waits for a terminal event after a racing load', async () => {
      const { ipc, runtime } = setup()
      ipc.onCommand('embed_status', () => LOADING)

      const pending = runtime.awaitTerminalStatus(LOADING)
      await vi.waitFor(() =>
        expect(ipc.calls().map((call) => call.command)).toContain('embed_status'),
      )
      ipc.emit('embed:status', READY)

      await expect(pending).resolves.toEqual(READY)
    })

    it('re-polls once the listener lands, in case the event already fired', async () => {
      const { ipc, runtime } = setup()
      ipc.onCommand('embed_status', () => READY)
      await expect(runtime.awaitTerminalStatus(LOADING)).resolves.toEqual(READY)
    })
  })

  describe('retry', () => {
    it('re-loads a failed model', async () => {
      const { ipc, runtime } = setup()
      ipc.onCommand('embed_status', () => ({ status: 'failed', message: 'offline' }))
      ipc.onCommand('embed_ensure', () => READY)

      await expect(runtime.retry()).resolves.toEqual(READY)
    })

    it('leaves any other status alone', async () => {
      const { ipc, runtime } = setup()
      ipc.onCommand('embed_status', () => READY)

      await expect(runtime.retry()).resolves.toEqual(READY)
      expect(ipc.calls().map((call) => call.command)).toEqual(['embed_status'])
    })

    it('resolves a throwing re-load as failed', async () => {
      const { ipc, runtime } = setup()
      ipc.onCommand('embed_status', () => ({ status: 'failed', message: 'offline' }))
      ipc.onCommand('embed_ensure', () => {
        throw new Error('no disk space')
      })

      await expect(runtime.retry()).resolves.toMatchObject({ status: 'failed' })
    })
  })
})

describe('defaultEmbeddingRuntime', () => {
  it('returns the installed service until it is cleared', () => {
    const fake = createTestEmbeddingRuntimeService()
    setDefaultEmbeddingRuntime(fake)
    expect(defaultEmbeddingRuntime()).toBe(fake)

    setDefaultEmbeddingRuntime(null)
    expect(defaultEmbeddingRuntime()).not.toBe(fake)
  })

  it('backs the free functions', async () => {
    const fake = createTestEmbeddingRuntimeService({ status: LOADING, vectors: () => [1, 2] })
    setDefaultEmbeddingRuntime(fake)

    await expect(embedStatus()).resolves.toEqual(LOADING)
    await expect(embedEnsure()).resolves.toEqual(LOADING)
    expect(fake.ensureCalls()).toBe(1)

    const seen: EmbedStatus[] = []
    const unlisten = await subscribeEmbedStatus((status) => {
      seen.push(status)
    })
    fake.setStatus(READY)
    unlisten()
    expect(seen).toEqual([READY])

    await expect(embedTexts(['a', 'b'])).resolves.toEqual([
      [1, 2],
      [1, 2],
    ])
    expect(fake.embedCalls()).toEqual([['a', 'b']])
  })
})
