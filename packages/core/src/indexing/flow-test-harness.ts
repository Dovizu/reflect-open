import { expect } from 'vitest'
import { resolveOrCreateNoteWithTitle } from '../graph/create-note.ts'
import { resolveExistingWikiTarget } from '../graph/resolve-existing-wiki-target.ts'
import { normalizeWikiTarget, parseNote } from '../markdown/index.ts'
import { setDefaultIpc } from '../ipc/bridge.ts'
import { ReflectError } from '../errors.ts'
import { createTestIpcBridgeService } from '../testing/ipc.ts'
import type { TestDatabaseService } from '../testing/database.ts'
import { setDefaultDatabase } from './database-service.ts'
import { buildIndexedNote, type IndexedNote } from './indexed-note.ts'
import type { suggestWikiLinkTargets } from './queries.ts'

/**
 * Shared helpers for projection-flow tests (`*-flow.test.ts`): projections
 * built from real Markdown, an index connection where disk probes see an
 * empty graph, and the end-to-end "selecting this suggestion opens its path"
 * assertion.
 */

export function project(path: string, source: string, mtime: number): IndexedNote {
  return buildIndexedNote(parseNote({ path, source }), {
    fileHash: `hash-${path}`,
    mtime,
    source,
  })
}

export function connectIndex(database: TestDatabaseService): void {
  setDefaultDatabase(database)
  // The projections exist only in the index. Disk probes see an empty
  // graph, so the writable resolvers exercise their indexed tiers.
  const notOnDisk = (): never => {
    throw new ReflectError('notFound', 'not on disk')
  }
  setDefaultIpc(
    createTestIpcBridgeService({
      commands: { list_files: () => [], note_read: notOnDisk, note_read_local: notOnDisk },
    }),
  )
}

export function disconnectIndex(database: TestDatabaseService): void {
  setDefaultIpc(null)
  setDefaultDatabase(null)
  database.close()
}

export async function expectSuggestionOpensItsPath(
  suggestion: Awaited<ReturnType<typeof suggestWikiLinkTargets>>['suggestions'][number],
): Promise<void> {
  expect(suggestion.path).not.toBeNull()
  const parsed = parseNote({
    path: 'notes/selection-check.md',
    source: `[[${suggestion.insertText}]]`,
  }).wikiLinks
  expect(parsed).toHaveLength(1)
  const target = parsed[0]!.target
  // Both branches mirror the editor's writable click handler, which routes
  // date-shaped targets through the ambiguity-preserving existing-note
  // resolver and everything else through resolve-or-create.
  const resolution =
    normalizeWikiTarget(target).date !== undefined
      ? resolveExistingWikiTarget(target, 1)
      : resolveOrCreateNoteWithTitle(target, 1)
  await expect(resolution).resolves.toEqual({
    kind: 'resolved',
    path: suggestion.path,
  })
}
