import { describe, expect, it, vi } from 'vitest'
import { createNoteFileService } from '../graph/note-file-service.ts'
import { createTestClockService } from '../testing/clock.ts'
import { createTestFileChangeService } from '../testing/file-change.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import type { FileChange } from './file-change-service.ts'
/** A note file service over a bridge answering `invoke` and a file-change fake with the given echo setting. */
function install(echoOwnWrites: boolean, invoke: (command: string) => unknown = () => null) {
  const ipc = createTestIpcBridgeService()
  for (const command of ['note_write', 'note_delete']) {
    ipc.onCommand(command, () => invoke(command))
  }
  const fileChanges = createTestFileChangeService({ echoOwnWrites })
  const noteFile = createNoteFileService({ ipc, clock: createTestClockService(), fileChanges })
  return { noteFile, fileChanges }
}

describe('local write echo (Plan 19, decision 5)', () => {
  it('emits an upsert to file-change subscribers after a note write', async () => {
    const { noteFile, fileChanges } = install(true)
    const seen: FileChange[][] = []
    const unlisten = fileChanges.subscribe(({ changes }) => {
      seen.push([...changes])
    })

    await noteFile.write('daily/2026-06-12.md', 'hello', 1)

    expect(seen).toHaveLength(1)
    expect(seen[0]![0]).toMatchObject({ path: 'daily/2026-06-12.md', kind: 'upsert' })
    expect(seen[0]![0]!.modifiedMs).toBeTypeOf('number')
    unlisten()
  })

  it('emits a remove after a delete', async () => {
    const { noteFile, fileChanges } = install(true)
    const seen: FileChange[][] = []
    const unlisten = fileChanges.subscribe(({ changes }) => {
      seen.push([...changes])
    })

    await noteFile.delete('notes/gone.md', 1)

    expect(seen).toEqual([[{ path: 'notes/gone.md', kind: 'remove' }]])
    unlisten()
  })

  it('stamps the echo with the on-disk mtime the write returned', async () => {
    // The reconcile's read-free skip compares the stored row's mtime against
    // the file listing — only the write's own on-disk stamp can ever match.
    const { noteFile, fileChanges } = install(true, (command) =>
      command === 'note_write' ? 1_234 : null,
    )
    const seen: FileChange[][] = []
    const unlisten = fileChanges.subscribe(({ changes }) => {
      seen.push([...changes])
    })

    await noteFile.write('notes/a.md', 'hello', 1)

    expect(seen).toEqual([[{ path: 'notes/a.md', kind: 'upsert', modifiedMs: 1_234 }]])
    unlisten()
  })

  it('stays silent when disabled (the desktop default — the watcher covers it)', async () => {
    const { noteFile, fileChanges } = install(false)
    const handler = vi.fn()
    const unlisten = fileChanges.subscribe(handler)

    await noteFile.write('daily/2026-06-12.md', 'hello', 1)

    expect(handler).not.toHaveBeenCalled()
    unlisten()
  })

  it('does not emit when the write itself fails', async () => {
    const { noteFile, fileChanges } = install(true, () => {
      throw new Error('disk full')
    })
    const handler = vi.fn()
    const unlisten = fileChanges.subscribe(handler)

    await expect(noteFile.write('daily/2026-06-12.md', 'hello', 1)).rejects.toThrow()

    expect(handler).not.toHaveBeenCalled()
    unlisten()
  })
})
