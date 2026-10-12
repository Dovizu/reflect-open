import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteNote, writeNote } from '../graph/commands.ts'
import { createTestFileChangeService } from '../testing/file-change.ts'
import { createTestIpcBridgeService, installTestBridge } from '../testing/ipc.ts'
import { setDefaultFileChanges, type FileChange } from './file-change-service.ts'
import { subscribeFileChanges } from './file-changes.ts'

let uninstall: (() => void) | null = null

afterEach(() => {
  uninstall?.()
  uninstall = null
  setDefaultFileChanges(null)
})

/** Install a bridge answering `invoke` and a file-change fake with the given echo setting. */
function install(echoOwnWrites: boolean, invoke: (command: string) => unknown = () => null) {
  const ipc = createTestIpcBridgeService()
  for (const command of ['note_write', 'note_delete']) {
    ipc.onCommand(command, () => invoke(command))
  }
  uninstall = installTestBridge(ipc)
  setDefaultFileChanges(createTestFileChangeService({ echoOwnWrites }))
}

describe('local write echo (Plan 19, decision 5)', () => {
  it('emits an upsert to file-change subscribers after a note write', async () => {
    install(true)
    const seen: FileChange[][] = []
    const unlisten = await subscribeFileChanges((changes) => {
      seen.push(changes)
    })

    await writeNote('daily/2026-06-12.md', 'hello', 1)

    expect(seen).toHaveLength(1)
    expect(seen[0]![0]).toMatchObject({ path: 'daily/2026-06-12.md', kind: 'upsert' })
    expect(seen[0]![0]!.modifiedMs).toBeTypeOf('number')
    unlisten()
  })

  it('emits a remove after a delete', async () => {
    install(true)
    const seen: FileChange[][] = []
    const unlisten = await subscribeFileChanges((changes) => {
      seen.push(changes)
    })

    await deleteNote('notes/gone.md', 1)

    expect(seen).toEqual([[{ path: 'notes/gone.md', kind: 'remove' }]])
    unlisten()
  })

  it('stamps the echo with the on-disk mtime the write returned', async () => {
    // The reconcile's read-free skip compares the stored row's mtime against
    // the file listing — only the write's own on-disk stamp can ever match.
    install(true, (command) => (command === 'note_write' ? 1_234 : null))
    const seen: FileChange[][] = []
    const unlisten = await subscribeFileChanges((changes) => {
      seen.push(changes)
    })

    await writeNote('notes/a.md', 'hello', 1)

    expect(seen).toEqual([[{ path: 'notes/a.md', kind: 'upsert', modifiedMs: 1_234 }]])
    unlisten()
  })

  it('stays silent when disabled (the desktop default — the watcher covers it)', async () => {
    install(false)
    const handler = vi.fn()
    const unlisten = await subscribeFileChanges(handler)

    await writeNote('daily/2026-06-12.md', 'hello', 1)

    expect(handler).not.toHaveBeenCalled()
    unlisten()
  })

  it('does not emit when the write itself fails', async () => {
    install(true, () => {
      throw new Error('disk full')
    })
    const handler = vi.fn()
    const unlisten = await subscribeFileChanges(handler)

    await expect(writeNote('daily/2026-06-12.md', 'hello', 1)).rejects.toThrow()

    expect(handler).not.toHaveBeenCalled()
    unlisten()
  })
})
