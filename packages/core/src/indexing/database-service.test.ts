import { afterEach, describe, expect, it } from 'vitest'
import { setBridge } from '../ipc/bridge.ts'
import { createTestDatabaseService } from '../testing/database.ts'
import { createTestIpcBridgeService, installTestBridge } from '../testing/index.ts'
import { createDatabaseService, defaultDatabase, setDefaultDatabase } from './database-service.ts'
import { db } from './db.ts'
import { buildIndexedNote } from './indexed-note.ts'
import { parseNote } from '../markdown/index.ts'

afterEach(() => {
  setDefaultDatabase(null)
  setBridge(null)
})

describe('createDatabaseService', () => {
  it('sends each compiled query as `db_query`', async () => {
    const ipc = createTestIpcBridgeService({ commands: { db_query: () => [{ path: 'a.md' }] } })
    const database = createDatabaseService({ ipc })

    const rows = await database.db
      .selectFrom('notes')
      .select('path')
      .where('kind', '=', 'note')
      .execute()

    expect(rows).toEqual([{ path: 'a.md' }])
    expect(ipc.calls()).toEqual([
      {
        command: 'db_query',
        args: { sql: 'select "path" from "notes" where "kind" = ?', params: ['note'] },
      },
    ])
  })

  it('fails a response that is not a row array', async () => {
    const ipc = createTestIpcBridgeService({ commands: { db_query: () => ({ rows: [] }) } })
    const database = createDatabaseService({ ipc })

    await expect(database.db.selectFrom('notes').selectAll().execute()).rejects.toThrow(
      'db_query did not return a row array',
    )
  })

  it('rejects a failed query with its app error', async () => {
    const ipc = createTestIpcBridgeService({
      commands: {
        db_query: () => {
          throw { kind: 'io', message: 'index locked' }
        },
      },
    })
    const database = createDatabaseService({ ipc })

    await expect(database.runQuery('select 1', [])).rejects.toEqual({
      kind: 'io',
      message: 'index locked',
    })
  })

  it('rejects transactions', async () => {
    const database = createDatabaseService({ ipc: createTestIpcBridgeService() })

    await expect(database.db.transaction().execute(async () => {})).rejects.toThrow(
      'transactions run in Rust',
    )
  })
})

describe('defaultDatabase', () => {
  it('queries the bridge installed at query time', async () => {
    const service = defaultDatabase()
    const ipc = createTestIpcBridgeService({ commands: { db_query: () => [] } })
    installTestBridge(ipc)

    await expect(service.runQuery('select 1', [])).resolves.toEqual([])
    expect(ipc.calls()).toEqual([{ command: 'db_query', args: { sql: 'select 1', params: [] } }])
  })

  it('maps a missing bridge to an app error', async () => {
    await expect(defaultDatabase().runQuery('select 1', [])).rejects.toMatchObject({
      kind: 'unknown',
    })
  })

  it('routes the shared `db` through the installed service', async () => {
    const database = createTestDatabaseService()
    database.applyProjection(
      buildIndexedNote(parseNote({ path: 'notes/a.md', source: '# A\n' }), {
        fileHash: 'hash',
        mtime: 1,
        source: '# A\n',
      }),
    )
    setDefaultDatabase(database)
    try {
      await expect(db.selectFrom('notes').select(['path', 'title']).execute()).resolves.toEqual([
        { path: 'notes/a.md', title: 'A' },
      ])
    } finally {
      database.close()
    }
  })
})
