import { afterEach, describe, expect, it } from 'vitest'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import { createTestMobileStorageService } from '../testing/mobile-storage.ts'
import { mobileStorage, mobileStorageLocal } from './commands.ts'
import {
  createMobileStorageService,
  defaultMobileStorage,
  setDefaultMobileStorage,
} from './mobile-storage-service.ts'

const STORAGE = {
  localRoot: '/local/Documents',
  icloudDocumentsRoot: '/icloud/Documents',
  icloudGraphRoots: ['/icloud/Documents/Notes'],
}

afterEach(() => {
  setDefaultMobileStorage(null)
})

describe('createMobileStorageService', () => {
  it('resolves the storage roots and creates graphs', async () => {
    const graph = { root: '/icloud/Documents/Work', name: 'Work', generation: 2 }
    const ipc = createTestIpcBridgeService({
      commands: {
        mobile_storage: () => STORAGE,
        mobile_storage_local: () => STORAGE.localRoot,
        graph_create: () => graph,
      },
    })
    const storage = createMobileStorageService({ ipc })

    await expect(storage.resolve()).resolves.toEqual(STORAGE)
    await expect(storage.resolveLocal()).resolves.toBe(STORAGE.localRoot)
    await expect(storage.createGraph(graph.root)).resolves.toEqual(graph)
    expect(ipc.calls().at(-1)).toEqual({ command: 'graph_create', args: { path: graph.root } })
  })

  it('rejects a malformed storage answer with a parse error', async () => {
    const ipc = createTestIpcBridgeService({ commands: { mobile_storage: () => ({}) } })
    await expect(createMobileStorageService({ ipc }).resolve()).rejects.toMatchObject({
      kind: 'parse',
    })
  })
})

describe('defaultMobileStorage', () => {
  it('returns the installed service until it is cleared', () => {
    const fake = createTestMobileStorageService()
    setDefaultMobileStorage(fake)
    expect(defaultMobileStorage()).toBe(fake)

    setDefaultMobileStorage(null)
    expect(defaultMobileStorage()).not.toBe(fake)
  })

  it('backs the free functions', async () => {
    setDefaultMobileStorage(createTestMobileStorageService({ storage: STORAGE }))
    await expect(mobileStorage()).resolves.toEqual(STORAGE)
    await expect(mobileStorageLocal()).resolves.toBe('/local/Documents')
  })
})
