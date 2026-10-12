import { afterEach, describe, expect, it } from 'vitest'
import { setBridge } from '../ipc/bridge.ts'
import { setDefaultIndexStore } from '../indexing/index-store-service.ts'
import { applyIndexChanges } from '../indexing/live.ts'
import { createTestIndexStoreService } from '../testing/index-store.ts'
import { resolveOrCreateNoteWithTitle } from './create-note.ts'

afterEach(() => {
  setDefaultIndexStore(null)
  setBridge(null)
})

describe('cross-device emoji title resolution', () => {
  it('reuses the synced emoji-titled note for a bare wiki link without creating -2', async () => {
    const emojiPath = 'notes/business-ideas.md'
    const linkingPath = 'notes/linking.md'
    const files: Record<string, string> = {
      [emojiPath]: '# 🧠 Business ideas\n',
      [linkingPath]: 'An external edit linked [[Business ideas]].\n',
    }
    const indexStore = createTestIndexStoreService()
    setDefaultIndexStore(indexStore)
    const createCommands: string[] = []

    setBridge({
      invoke: async (command, args) => {
        if (command === 'db_query') {
          // The device's exact title index cannot match `Business ideas`
          // against the indexed `🧠 Business ideas` title.
          return []
        }
        if (command === 'note_read') {
          const path = String(args['path'])
          const source = files[path]
          if (source === undefined) {
            throw { kind: 'notFound', message: `${path} not found` }
          }
          return source
        }
        if (command === 'list_files') {
          return Object.entries(files).map(([path, source]) => ({
            path,
            size: source.length,
            modifiedMs: 1,
          }))
        }
        if (command === 'note_exists') {
          return String(args['path']) in files
        }
        if (command === 'note_write') {
          createCommands.push(command)
          files[String(args['path'])] = String(args['contents'])
          return 2
        }
        if (command === 'note_create') {
          createCommands.push(command)
          const path = String(args['path'])
          if (path in files) {
            return { kind: 'collision' }
          }
          files[path] = String(args['contents'])
          return { kind: 'created', modifiedMs: 2 }
        }
        return null
      },
      listen: async () => () => {},
    })

    await applyIndexChanges(
      [
        { path: emojiPath, kind: 'upsert', modifiedMs: 1 },
        { path: linkingPath, kind: 'upsert', modifiedMs: 1 },
      ],
      7,
    )

    const indexedNotes = indexStore.applied()
    expect(indexedNotes.find((note) => note.path === emojiPath)).toMatchObject({
      title: '🧠 Business ideas',
      titleKey: '🧠 business ideas',
    })
    const bareLink = indexedNotes
      .find((note) => note.path === linkingPath)
      ?.links.find((link) => link.kind === 'wiki')
    expect(bareLink).toMatchObject({
      targetRaw: 'Business ideas',
      targetKey: 'business ideas',
    })

    await expect(resolveOrCreateNoteWithTitle(bareLink?.targetRaw ?? '', 7)).resolves.toEqual({
      kind: 'resolved',
      path: emojiPath,
    })
    expect(createCommands).toEqual([])
    expect(files['notes/business-ideas-2.md']).toBeUndefined()
  })
})
