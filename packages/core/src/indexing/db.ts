import { createDb, type Database } from '@reflect/db'
import type { Kysely } from 'kysely'
import { defaultDatabase } from './database-service.ts'

/**
 * The shared Kysely instance over the active graph's SQLite index. Each query
 * runs through the {@link defaultDatabase} resolved at execution time, so this
 * instance is safe to create before any service or bridge is installed.
 */
export const db: Kysely<Database> = /* @__PURE__ */ createDb(
  async (sql, params) => await defaultDatabase().runQuery(sql, params),
)
