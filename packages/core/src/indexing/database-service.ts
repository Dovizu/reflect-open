import { createDb, type Database, type QueryRunner } from '@reflect/db'
import type { Kysely } from 'kysely'
import { z } from 'zod'
import { toAppError } from '../errors.ts'
import { currentIpc } from '../ipc/bridge.ts'
import type { IpcBridgeService } from '../ipc/ipc-service.ts'

/**
 * Typed read-only queries over the active graph's SQLite index. Queries
 * compile in TypeScript and execute in Rust via the `db_query` command.
 * Transactions and streams are rejected: writes go through the `index_*`
 * commands, which run their own Rust transactions.
 */
export interface DatabaseService {
  /** The Kysely instance whose queries execute through {@link runQuery}. */
  readonly db: Kysely<Database>
  /**
   * Execute one compiled query and resolve with its raw row array. A
   * rejection is an `AppError`.
   */
  readonly runQuery: QueryRunner
}

/**
 * Rows are the index's own projection, so they skip per-row validation; the
 * dialect still fails fast on a response that is not a row array.
 */
const rowsSchema = z.unknown()

/** A {@link DatabaseService} over the `db_query` command. */
export function createDatabaseService(deps: { ipc: IpcBridgeService }): DatabaseService {
  const { ipc } = deps
  const runQuery: QueryRunner = async (sql, params) => {
    try {
      return await ipc.call('db_query', { sql, params: [...params] }, rowsSchema)
    } catch (error) {
      throw toAppError(error)
    }
  }
  return { db: createDb(runQuery), runQuery }
}

let defaultService: DatabaseService | null = null

/**
 * The process-wide `DatabaseService`; one over the bridge installed at query
 * time unless {@link setDefaultDatabase} installed another.
 */
export function defaultDatabase(): DatabaseService {
  defaultService ??= createDatabaseService({ ipc: currentIpc() })
  return defaultService
}

/** Install the process-wide `DatabaseService`; `null` restores the bridge-backed one. */
export function setDefaultDatabase(service: DatabaseService | null): void {
  defaultService = service
}
