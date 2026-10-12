import { afterEach, describe, expect, it } from 'vitest'
import { buildIndexedNote, parseNote, setDefaultDatabase, suggestWikiTargets } from '@reflect/core'
import { createTestAppServices, seedNotes } from '@reflect/core/testing'
import { createWasmTestDatabaseService } from '@/test-utils/test-database.ts'

afterEach(() => {
  setDefaultDatabase(null)
})

function projection(path: string, source: string) {
  return buildIndexedNote(parseNote({ path, source }), {
    fileHash: `hash-${path}`,
    mtime: 1,
    source,
  })
}

describe('createWasmTestDatabaseService', () => {
  it('answers the shared queries from seeded projections', async () => {
    const database = await createWasmTestDatabaseService()
    database.applyProjection(projection('notes/hub.md', '# Hub\n'))
    database.applyProjection(projection('daily/2026-01-10.md', '[[Hub]]\n'))
    setDefaultDatabase(database)
    try {
      const suggestions = await suggestWikiTargets('hub')
      expect(suggestions.map((suggestion) => suggestion.path)).toEqual(['notes/hub.md'])
    } finally {
      database.close()
    }
  })

  it('rejects queries after close', async () => {
    const database = await createWasmTestDatabaseService()
    database.close()
    await expect(database.runQuery('select 1', [])).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('createTestAppServices in the browser', () => {
  it('reads the index through the wasm database by default', async () => {
    const app = createTestAppServices()
    seedNotes(app.database, [{ path: 'notes/hub.md', markdown: '# Hub\n' }])
    try {
      await expect(app.wikiResolver.resolveWikiTarget('Hub')).resolves.toEqual({
        kind: 'resolved',
        ref: 'notes/hub.md',
      })
    } finally {
      app.database.close()
    }
  })
})
