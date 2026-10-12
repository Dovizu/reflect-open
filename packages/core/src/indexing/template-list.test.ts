import { describe, expect, it } from 'vitest'
import { createTestDatabaseService, seedNotes } from '../testing/database.ts'
import { createIndexQueryService } from './index-query-service.ts'

describe('listTemplates', () => {
  it('lists only template-kind rows, A→Z by folded title', async () => {
    const database = createTestDatabaseService()
    seedNotes(database, [
      { path: 'templates/person.md', markdown: '# person\n', mtime: 2 },
      { path: 'templates/journal.md', markdown: '# Journal\n', mtime: 1 },
      { path: 'notes/agenda.md', markdown: '# Agenda\n' },
      { path: 'daily/2026-06-09.md', markdown: 'Standup\n' },
    ])

    await expect(createIndexQueryService({ database }).listTemplates()).resolves.toEqual([
      { path: 'templates/journal.md', title: 'Journal', mtime: 1 },
      { path: 'templates/person.md', title: 'person', mtime: 2 },
    ])
  })
})
