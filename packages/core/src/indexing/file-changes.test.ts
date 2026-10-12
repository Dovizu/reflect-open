import { describe, expect, it } from 'vitest'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createFileChangeService, type FileChange } from './file-change-service.ts'

function install() {
  const ipc = createTestIpcBridgeService()
  const fileChanges = createFileChangeService(
    { ipc, logger: createTestLoggerService() },
    { echoOwnWrites: false },
  )
  return { fileChanges, emitFromBridge: (payload: unknown) => ipc.emit('index:changed', payload) }
}

describe('FileChangeService.subscribe', () => {
  it('delivers locally emitted batches (sync merges) like watcher events', async () => {
    const { fileChanges } = install()
    const received: FileChange[][] = []
    const unlisten = fileChanges.subscribe(({ changes }) => {
      received.push(changes)
    })

    const changes: FileChange[] = [
      { path: 'notes/from-b.md', kind: 'upsert', modifiedMs: 123 },
      { path: 'notes/gone.md', kind: 'remove' },
    ]
    fileChanges.emit({ changes: changes, source: 'external' })

    expect(received).toEqual([changes])
    unlisten()
  })

  it('stops local delivery after unlisten', async () => {
    const { fileChanges } = install()
    const received: FileChange[][] = []
    const unlisten = fileChanges.subscribe(({ changes }) => {
      received.push(changes)
    })
    unlisten()

    fileChanges.emit({ changes: [{ path: 'notes/a.md', kind: 'upsert' }], source: 'external' })

    expect(received).toEqual([])
  })

  it('delivers both bridge and local batches to the same subscriber', async () => {
    const { fileChanges, emitFromBridge } = install()
    const received: FileChange[][] = []
    const unlisten = fileChanges.subscribe(({ changes }) => {
      received.push(changes)
    })
    await Promise.resolve()

    emitFromBridge([{ path: 'notes/watched.md', kind: 'upsert' }])
    fileChanges.emit({ changes: [{ path: 'notes/merged.md', kind: 'upsert' }], source: 'external' })

    expect(received.map((batch) => batch[0]!.path)).toEqual(['notes/watched.md', 'notes/merged.md'])
    unlisten()
  })
})
