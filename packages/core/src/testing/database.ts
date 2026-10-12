import { createDb } from '@reflect/db'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { getLoadablePath } from 'sqlite-vec'
import { toAppError } from '../errors.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import type { IndexedNote } from '../indexing/indexed-note.ts'

export interface TestDatabaseService extends DatabaseService {
  /** Insert the `notes`, `aliases`, `note_claims` and `links` rows of `note`. */
  applyProjection(note: IndexedNote): void
  /** Release the database; later queries and seeding throw. */
  close(): void
}

const MIGRATIONS_DIRECTORY = new URL('../../../../crates/index-schema/migrations/', import.meta.url)

function nodeBuiltins(): Pick<NodeJS.Process, 'getBuiltinModule'> {
  if (typeof process === 'undefined' || typeof process.getBuiltinModule !== 'function') {
    throw new TypeError(
      'createTestDatabaseService needs Node.js; browser tests use the wasm test database in apps/desktop',
    )
  }
  return process
}

function openMigratedIndex(): DatabaseSync {
  const node = nodeBuiltins()
  const { DatabaseSync } = node.getBuiltinModule('node:sqlite')
  const { readFileSync, readdirSync } = node.getBuiltinModule('node:fs')
  const { fileURLToPath } = node.getBuiltinModule('node:url')
  const { createRequire } = node.getBuiltinModule('node:module')
  const sqliteVec = createRequire(import.meta.url)('sqlite-vec') as {
    getLoadablePath: typeof getLoadablePath
  }
  const directory = fileURLToPath(MIGRATIONS_DIRECTORY)
  const database = new DatabaseSync(':memory:', { allowExtension: true })
  try {
    // Keep this an exact production migration chain: 0002/0003 create vec0
    // tables, so their native extension must be available before replay.
    database.loadExtension(sqliteVec.getLoadablePath())
    const migrations = readdirSync(directory)
      .filter((filename) => filename.endsWith('.sql'))
      .sort()
    for (const migration of migrations) {
      database.exec(readFileSync(`${directory}/${migration}`, 'utf8'))
    }
    return database
  } catch (error) {
    database.close()
    throw error
  }
}

function sqliteParameter(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  ) {
    return value
  }
  throw new TypeError(`unsupported SQLite parameter: ${typeof value}`)
}

function insertProjection(database: DatabaseSync, indexed: IndexedNote): void {
  database
    .prepare(
      `INSERT INTO notes(
        path, id, title, title_key, path_key, kind, daily_date, is_private, is_pinned,
        pinned_order, mtime, file_hash, preview, has_conflict, gist_url, gist_stale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      indexed.path,
      indexed.id,
      indexed.title,
      indexed.titleKey,
      indexed.pathKey,
      indexed.kind,
      indexed.dailyDate,
      Number(indexed.isPrivate),
      Number(indexed.isPinned),
      indexed.pinnedOrder,
      indexed.mtime,
      indexed.fileHash,
      indexed.preview,
      Number(indexed.hasConflict),
      indexed.gistUrl,
      Number(indexed.gistStale),
    )

  const insertAlias = database.prepare(
    'INSERT INTO aliases(note_path, alias, alias_key) VALUES (?, ?, ?)',
  )
  for (const alias of indexed.aliases) {
    insertAlias.run(indexed.path, alias.alias, alias.aliasKey)
  }

  const insertClaim = database.prepare(
    'INSERT INTO note_claims(note_path, key, tier) VALUES (?, ?, ?)',
  )
  for (const claim of indexed.claims) {
    insertClaim.run(indexed.path, claim.key, claim.tier)
  }

  const insertLink = database.prepare(
    `INSERT INTO links(
      source_path, kind, target_raw, target_key, target_path_key, alias, pos_from, pos_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const link of indexed.links) {
    insertLink.run(
      indexed.path,
      link.kind,
      link.targetRaw,
      link.targetKey,
      link.targetPathKey,
      link.alias,
      link.posFrom,
      link.posTo,
    )
  }
}

/**
 * A {@link DatabaseService} over a real in-memory SQLite index built from the
 * production migration chain. The database opens on first use, so building
 * one is cheap. Node.js only (`node:sqlite`); the browser backend lives in
 * the desktop app because its wasm asset loading is Vite-specific.
 */
export function createTestDatabaseService(): TestDatabaseService {
  let database: DatabaseSync | null = null
  let closed = false

  function open(): DatabaseSync {
    if (closed) {
      throw new Error('the test database is closed')
    }
    database ??= openMigratedIndex()
    return database
  }

  const runQuery = async (sql: string, params: readonly unknown[]): Promise<unknown> => {
    try {
      return open()
        .prepare(sql)
        .all(...params.map(sqliteParameter))
    } catch (error) {
      throw toAppError(error)
    }
  }

  return {
    db: createDb(runQuery),
    runQuery,
    applyProjection(note) {
      insertProjection(open(), note)
    },
    close() {
      closed = true
      database?.close()
      database = null
    },
  }
}
