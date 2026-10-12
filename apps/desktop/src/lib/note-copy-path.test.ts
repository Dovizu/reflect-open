import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultClipboard, setDefaultPath } from '@reflect/core'
import {
  createTestClipboardService,
  createTestPathService,
  type TestClipboardService,
} from '@reflect/core/testing'

const operationDone = vi.hoisted(() => vi.fn())
const operationFail = vi.hoisted(() => vi.fn())
const startOperation = vi.hoisted(() =>
  vi.fn(() => ({ progress: vi.fn(), done: operationDone, fail: operationFail })),
)
vi.mock('@/lib/operations.ts', () => ({ startOperation }))

const { runCopyNotePath } = await import('./note-copy-path.ts')

let clipboard: TestClipboardService

beforeEach(() => {
  startOperation.mockClear()
  operationDone.mockClear()
  operationFail.mockClear()
  clipboard = createTestClipboardService()
  setDefaultClipboard(clipboard)
  setDefaultPath(createTestPathService())
})

describe('runCopyNotePath', () => {
  it('copies the OS-joined absolute path and completes the operation', async () => {
    await runCopyNotePath('/g', 'notes/a.md')
    expect(clipboard.writes()).toEqual(['/g/notes/a.md'])
    expect(startOperation).toHaveBeenCalledWith('Note path copied')
    expect(operationDone).toHaveBeenCalled()
    expect(operationFail).not.toHaveBeenCalled()
  })

  it('fails loudly when no graph is open', async () => {
    await runCopyNotePath(null, 'notes/a.md')
    expect(startOperation).toHaveBeenCalledWith('Copying note path')
    expect(operationFail).toHaveBeenCalledWith('No graph is open')
  })

  it('reports a clipboard failure through the operation', async () => {
    clipboard.failWith(new Error('denied'))
    await runCopyNotePath('/g', 'notes/a.md')
    expect(startOperation).toHaveBeenCalledWith('Copying note path')
    expect(operationFail).toHaveBeenCalledWith('denied')
  })
})
