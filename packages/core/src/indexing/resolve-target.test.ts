import { describe, expect, it } from 'vitest'
import { createTestDatabaseService, seedNotes } from '../testing/database.ts'
import { createIndexQueryService, type IndexQueryService } from './index-query-service.ts'

function setup(): IndexQueryService {
  const database = createTestDatabaseService()
  seedNotes(database, [
    {
      path: 'notes/project-x.md',
      markdown: '---\nid: 01hzy3v9k2m4n6p8q0r2s4t6vw\n---\n# Project X\n',
    },
    { path: 'notes/project-x-2.md', markdown: '# Project X\n' },
    { path: 'notes/foo.md', markdown: '# Something Else\n' },
    { path: 'notes/aliased.md', markdown: '---\naliases: [PX]\n---\n# Aliased\n' },
    { path: 'notes/zz-id-title.md', markdown: '# 01hzy3v9k2m4n6p8q0r2s4t6vw\n' },
  ])
  return createIndexQueryService({ database })
}

describe('resolveNoteTarget', () => {
  it('resolves a frontmatter id first, ahead of a title spelled the same', async () => {
    await expect(setup().resolveNoteTarget('01hzy3v9k2m4n6p8q0r2s4t6vw')).resolves.toBe(
      'notes/project-x.md',
    )
  })

  it('resolves a calendar date to the daily path even when the file does not exist', async () => {
    await expect(setup().resolveNoteTarget('2026-07-01')).resolves.toBe('daily/2026-07-01.md')
  })

  it('does not treat an impossible date as a daily note', async () => {
    await expect(setup().resolveNoteTarget('2026-02-31')).resolves.toBeNull()
  })

  it('resolves an explicit graph-relative path when the index knows it', async () => {
    const service = setup()
    await expect(service.resolveNoteTarget('notes/foo.md')).resolves.toBe('notes/foo.md')
    await expect(service.resolveNoteTarget('notes/missing.md')).resolves.toBeNull()
  })

  it('falls back to a case-folded title match, first path alphabetically', async () => {
    await expect(setup().resolveNoteTarget('PROJECT x')).resolves.toBe('notes/project-x-2.md')
  })

  it('falls back to an alias match last, and to null when nothing matches', async () => {
    const service = setup()
    await expect(service.resolveNoteTarget('px')).resolves.toBe('notes/aliased.md')
    await expect(service.resolveNoteTarget('nothing matches this')).resolves.toBeNull()
  })
})
