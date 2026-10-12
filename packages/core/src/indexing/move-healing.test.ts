import { afterEach, describe, expect, it } from 'vitest'
import { createTestDatabaseService, seedNotes } from '../testing/database.ts'
import { createTestNoteFileService } from '../testing/graph.ts'
import { createIndexQueryService } from './index-query-service.ts'
import { createMoveHealing } from './move-healing.ts'

const databases: { close(): void }[] = []

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close()
  }
})

const ORPHAN = 'notes/01arz3ndektsv4rrffq69g5fav.md'
const ARRIVAL = 'notes/meeting-notes.md'
const ID = '01abcdefghjkmnpqrstvwxyz00'
const CONTENT = `---\nid: ${ID}\n---\n# Meeting Notes\n`

/**
 * Move healing where ORPHAN is indexed with its id and ARRIVAL exists on disk.
 * `read` runs before each note read and may reject it; `lookup` runs before
 * the id lookup.
 */
function setup(options?: { read?: () => void; lookup?: () => void }) {
  const database = createTestDatabaseService()
  databases.push(database)
  seedNotes(database, [{ path: ORPHAN, markdown: CONTENT }])
  const files = createTestNoteFileService({ files: { [ARRIVAL]: CONTENT } })
  const indexQuery = createIndexQueryService({ database })
  const calls: string[] = []
  const healing = createMoveHealing({
    noteFile: {
      ...files,
      read: async (path, generation) => {
        calls.push('read')
        options?.read?.()
        return await files.read(path, generation)
      },
    },
    indexQuery: {
      ...indexQuery,
      getNoteIdsByPath: async (paths) => {
        calls.push('lookup')
        options?.lookup?.()
        return await indexQuery.getNoteIdsByPath(paths)
      },
    },
  })
  return { healing, calls }
}

describe('MoveHealing.detectExternalMoves', () => {
  it('pairs an orphan with the arrival carrying its id and hands back the content', async () => {
    const { healing } = setup()

    const scan = await healing.detectExternalMoves([ORPHAN], [ARRIVAL])
    expect(scan.moves).toEqual([{ from: ORPHAN, to: ARRIVAL }])
    expect(scan.content.get(ARRIVAL)).toBe(CONTENT)
  })

  it('skips an unreadable arrival: no pair, no content, no throw', async () => {
    const { healing } = setup({
      read: () => {
        throw { kind: 'io', message: 'locked' }
      },
    })

    const scan = await healing.detectExternalMoves([ORPHAN], [ARRIVAL])
    expect(scan.moves).toEqual([])
    expect(scan.content.size).toBe(0)
  })

  it('never reads or queries when either side is empty', async () => {
    const { healing, calls } = setup()

    expect((await healing.detectExternalMoves([], [ARRIVAL])).moves).toEqual([])
    expect((await healing.detectExternalMoves([ORPHAN], [])).moves).toEqual([])
    expect(calls).toEqual([])
  })

  it('returns no moves once aborted — the caller is bailing anyway', async () => {
    const controller = new AbortController()
    const { healing } = setup({ lookup: () => controller.abort() })

    const scan = await healing.detectExternalMoves([ORPHAN], [ARRIVAL], {
      signal: controller.signal,
    })
    expect(scan.moves).toEqual([])
  })
})
