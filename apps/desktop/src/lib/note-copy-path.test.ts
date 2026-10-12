import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  setDefaultClipboard,
  setDefaultPath,
  setDefaultOperations,
  MIN_VISIBLE_MS,
} from '@reflect/core'
import {
  createTestClipboardService,
  createTestPathService,
  type TestClipboardService,
  createTestOperationsService,
  type TestOperationsService,
} from '@reflect/core/testing'

const { runCopyNotePath } = await import('./note-copy-path.ts')

let clipboard: TestClipboardService

let operations: TestOperationsService

beforeEach(() => {
  operations = createTestOperationsService()
  setDefaultOperations(operations)
  clipboard = createTestClipboardService()
  setDefaultClipboard(clipboard)
  setDefaultPath(createTestPathService())
})

afterEach(() => {
  setDefaultOperations(null)
})

describe('runCopyNotePath', () => {
  it('copies the OS-joined absolute path and completes the operation', async () => {
    await runCopyNotePath('/g', 'notes/a.md')
    expect(clipboard.writes()).toEqual(['/g/notes/a.md'])
    expect(operations.snapshot()).toMatchObject([{ label: 'Note path copied', status: 'running' }])
    await operations.clock.advance(MIN_VISIBLE_MS)
    expect(operations.getAll()).toEqual([])
  })

  it('fails loudly when no graph is open', async () => {
    await runCopyNotePath(null, 'notes/a.md')
    expect(operations.snapshot()).toMatchObject([
      { label: 'Copying note path', status: 'failed', message: 'No graph is open' },
    ])
  })

  it('reports a clipboard failure through the operation', async () => {
    clipboard.failWith(new Error('denied'))
    await runCopyNotePath('/g', 'notes/a.md')
    expect(operations.snapshot()).toMatchObject([
      { label: 'Copying note path', status: 'failed', message: 'denied' },
    ])
  })
})
