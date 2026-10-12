import { createDb } from '@reflect/db'
import { toAppError } from '@reflect/core'
import type { TestDatabaseService } from '@reflect/core/testing'
import { createDevIndexDb } from '@/dev/dev-index-db.ts'

/**
 * The browser twin of `createTestDatabaseService()` from
 * `@reflect/core/testing`: the same real migrations over the dev bridge's wasm
 * SQLite, which only loads under this app's Vite config.
 */
export async function createWasmTestDatabaseService(): Promise<TestDatabaseService> {
  const index = await createDevIndexDb()
  let closed = false

  const runQuery = async (sql: string, params: readonly unknown[]): Promise<unknown> => {
    try {
      if (closed) {
        throw new Error('the test database is closed')
      }
      return index.query(sql, params)
    } catch (error) {
      throw toAppError(error)
    }
  }

  return {
    db: createDb(runQuery),
    runQuery,
    applyProjection(note) {
      if (closed) {
        throw new Error('the test database is closed')
      }
      index.applyNote(note)
    },
    close() {
      if (!closed) {
        closed = true
        index.close()
      }
    },
  }
}
