import { afterEach, describe, expect, it } from 'vitest'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import {
  createFileChangeService,
  setDefaultFileChanges,
  type FileChange,
} from './file-change-service.ts'
import { emitFileChanges, subscribeFileChanges } from './file-changes.ts'

afterEach(() => {
  setDefaultFileChanges(null)
})

function install() {
  const ipc = createTestIpcBridgeService()
  setDefaultFileChanges(
    createFileChangeService({ ipc, logger: createTestLoggerService() }, { echoOwnWrites: false }),
  )
  return { emitFromBridge: (payload: unknown) => ipc.emit('index:changed', payload) }
}

describe('subscribeFileChanges', () => {
  it('delivers locally emitted batches (sync merges) like watcher events', async () => {
    install()
    const received: FileChange[][] = []
    const unlisten = await subscribeFileChanges((changes) => {
      received.push(changes)
    })

    const changes: FileChange[] = [
      { path: 'notes/from-b.md', kind: 'upsert', modifiedMs: 123 },
      { path: 'notes/gone.md', kind: 'remove' },
    ]
    emitFileChanges(changes, 'external')

    expect(received).toEqual([changes])
    unlisten()
  })

  it('stops local delivery after unlisten', async () => {
    install()
    const received: FileChange[][] = []
    const unlisten = await subscribeFileChanges((changes) => {
      received.push(changes)
    })
    unlisten()

    emitFileChanges([{ path: 'notes/a.md', kind: 'upsert' }], 'external')

    expect(received).toEqual([])
  })

  it('delivers both bridge and local batches to the same subscriber', async () => {
    const { emitFromBridge } = install()
    const received: FileChange[][] = []
    const unlisten = await subscribeFileChanges((changes) => {
      received.push(changes)
    })
    await Promise.resolve()

    emitFromBridge([{ path: 'notes/watched.md', kind: 'upsert' }])
    emitFileChanges([{ path: 'notes/merged.md', kind: 'upsert' }], 'external')

    expect(received.map((batch) => batch[0]!.path)).toEqual(['notes/watched.md', 'notes/merged.md'])
    unlisten()
  })
})
