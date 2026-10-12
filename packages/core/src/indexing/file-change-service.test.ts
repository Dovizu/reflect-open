import { afterEach, describe, expect, it, vi } from 'vitest'
import { setDefaultLogger } from '../app/logger-service.ts'
import { setDefaultPlatform } from '../app/platform-service.ts'
import { currentIpc } from '../ipc/bridge.ts'
import { createTestFileChangeService } from '../testing/file-change.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestPlatformService } from '../testing/platform.ts'
import {
  createFileChangeService,
  defaultFileChanges,
  setDefaultFileChanges,
  type FileChangeBatch,
} from './file-change-service.ts'

function setup(echoOwnWrites = false) {
  const ipc = createTestIpcBridgeService()
  const logger = createTestLoggerService()
  const fileChanges = createFileChangeService({ ipc, logger }, { echoOwnWrites })
  return { ipc, logger, fileChanges }
}

/** Let `listenNow` finish registering. */
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  setDefaultFileChanges(null)
  setDefaultPlatform(null)
  setDefaultLogger(null)
})

describe('createFileChangeService', () => {
  it('delivers watcher events and emitted batches with their source', async () => {
    const { ipc, fileChanges } = setup()
    const seen: FileChangeBatch[] = []
    const unlisten = fileChanges.subscribe((batch) => {
      seen.push(batch)
    })
    await settle()

    ipc.emit('index:changed', [{ path: 'notes/watched.md', kind: 'upsert', modifiedMs: 1 }])
    fileChanges.emit({ changes: [{ path: 'notes/pulled.md', kind: 'upsert' }], source: 'pull' })
    unlisten()
    ipc.emit('index:changed', [{ path: 'notes/late.md', kind: 'remove' }])
    fileChanges.emit({ changes: [{ path: 'notes/late.md', kind: 'remove' }], source: 'pull' })

    expect(seen).toEqual([
      {
        changes: [{ path: 'notes/watched.md', kind: 'upsert', modifiedMs: 1 }],
        source: 'external',
      },
      { changes: [{ path: 'notes/pulled.md', kind: 'upsert' }], source: 'pull' },
    ])
  })

  it('subscribes synchronously, before the native listener registers', () => {
    const { fileChanges } = setup()
    const listener = vi.fn()
    fileChanges.subscribe(listener)

    fileChanges.emit({ changes: [{ path: 'notes/a.md', kind: 'upsert' }], source: 'external' })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('drops a malformed watcher payload with an error', async () => {
    const { ipc, logger, fileChanges } = setup()
    const listener = vi.fn()
    fileChanges.subscribe(listener)
    await settle()

    ipc.emit('index:changed', { not: 'an array' })

    expect(listener).not.toHaveBeenCalled()
    expect(logger.getErrors().map((entry) => entry.message)).toEqual([
      'invalid index:changed payload:',
    ])
  })

  it('keeps no listener and does not throw when no transport is installed', async () => {
    const logger = createTestLoggerService()
    const fileChanges = createFileChangeService(
      { ipc: currentIpc(), logger },
      { echoOwnWrites: false },
    )
    const listener = vi.fn()
    const reconcile = vi.fn()

    const unlisten = fileChanges.subscribe(listener)
    const unlistenReconcile = fileChanges.subscribeReconcile(reconcile)
    await settle()
    unlisten()
    unlistenReconcile()
    fileChanges.emit({ changes: [{ path: 'notes/a.md', kind: 'upsert' }], source: 'external' })

    expect(listener).not.toHaveBeenCalled()
    expect(logger.getWarnings().map((entry) => entry.message)).toEqual([
      'failed to listen for "index:changed"',
      'failed to listen for "index:reconcile"',
    ])
  })

  it('detaches a native listener that registers after unlisten', async () => {
    const { ipc, fileChanges } = setup()
    const listener = vi.fn()
    fileChanges.subscribe(listener)()
    await settle()

    ipc.emit('index:changed', [{ path: 'notes/a.md', kind: 'upsert' }])

    expect(listener).not.toHaveBeenCalled()
  })

  it('forwards reconcile requests until unlisten', async () => {
    const { ipc, fileChanges } = setup()
    const listener = vi.fn()
    const unlisten = fileChanges.subscribeReconcile(listener)
    await settle()

    ipc.emit('index:reconcile', null)
    unlisten()
    ipc.emit('index:reconcile', null)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('tells own-write observers but not the change stream when echo is off', () => {
    const { fileChanges } = setup(false)
    const changes = vi.fn()
    const ownWrites: (readonly string[])[] = []
    fileChanges.subscribe(changes)
    fileChanges.subscribeOwnWrites((paths) => {
      ownWrites.push(paths)
    })

    fileChanges.reportOwnWrite([{ path: 'notes/a.md', kind: 'upsert', modifiedMs: 1 }])

    expect(ownWrites).toEqual([['notes/a.md']])
    expect(changes).not.toHaveBeenCalled()
  })

  it('echoes own writes onto the change stream when echo is on', () => {
    const { fileChanges } = setup(true)
    const seen: FileChangeBatch[] = []
    const ownWrites: (readonly string[])[] = []
    fileChanges.subscribe((batch) => {
      seen.push(batch)
    })
    fileChanges.subscribeOwnWrites((paths) => {
      ownWrites.push(paths)
    })

    fileChanges.reportOwnWrite([{ path: 'notes/gone.md', kind: 'remove' }])

    expect(ownWrites).toEqual([['notes/gone.md']])
    expect(seen).toEqual([
      { changes: [{ path: 'notes/gone.md', kind: 'remove' }], source: 'own-write' },
    ])
  })

  it('logs a failing own-write observer and still notifies the rest', () => {
    const { logger, fileChanges } = setup(true)
    const seen = vi.fn()
    fileChanges.subscribeOwnWrites(() => {
      throw new Error('boom')
    })
    fileChanges.subscribe(seen)

    fileChanges.reportOwnWrite([{ path: 'notes/a.md', kind: 'upsert' }])

    expect(logger.getErrors().map((entry) => entry.message)).toEqual(['own-write observer failed:'])
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('starts and stops the native watcher', async () => {
    const { ipc, fileChanges } = setup()
    ipc.onCommand('watch_start', () => null)
    ipc.onCommand('watch_stop', () => null)

    await fileChanges.startWatcher()
    await fileChanges.stopWatcher()

    expect(ipc.calls()).toEqual([
      { command: 'watch_start', args: {} },
      { command: 'watch_stop', args: {} },
    ])
  })
})

describe('defaultFileChanges', () => {
  it('returns the installed service until it is cleared', () => {
    const fake = createTestFileChangeService()
    setDefaultFileChanges(fake)
    expect(defaultFileChanges()).toBe(fake)

    setDefaultFileChanges(null)
    expect(defaultFileChanges()).not.toBe(fake)
  })

  it('echoes own writes on mobile only', () => {
    setDefaultLogger(createTestLoggerService())
    for (const [appPlatform, echoed] of [
      ['desktop', 0],
      ['ios', 1],
    ] as const) {
      setDefaultPlatform(createTestPlatformService({ appPlatform }))
      setDefaultFileChanges(null)
      const listener = vi.fn()
      defaultFileChanges().subscribe(listener)

      defaultFileChanges().reportOwnWrite([{ path: 'notes/a.md', kind: 'upsert' }])

      expect(listener).toHaveBeenCalledTimes(echoed)
    }
  })
})
