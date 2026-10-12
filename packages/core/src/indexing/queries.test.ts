import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NoteFileService } from '../graph/note-file-service.ts'
import {
  createTestDatabaseService,
  seedNotes,
  type TestDatabaseService,
  type TestNote,
} from '../testing/database.ts'
import { createTestNoteFileService } from '../testing/graph.ts'
import { createBacklinkService, type BacklinkService } from './backlink-service.ts'
import { setDefaultDatabase } from './database-service.ts'
import { createIndexQueryService } from './index-query-service.ts'
import { dailyDatesInRange, listDailyNotes } from './queries.ts'
import { createSuggestionService } from './suggestion-service.ts'
import { createWikiResolverService } from './wiki-resolver-service.ts'

function seeded(notes: readonly TestNote[]): TestDatabaseService {
  const database = createTestDatabaseService()
  seedNotes(database, notes)
  return database
}

describe('dailyDatesInRange', () => {
  let database: TestDatabaseService

  beforeEach(() => {
    database = createTestDatabaseService()
    setDefaultDatabase(database)
  })

  afterEach(() => {
    setDefaultDatabase(null)
  })

  it('lists the dates with content within inclusive bounds', async () => {
    seedNotes(database, [
      { path: 'daily/2026-05-31.md', markdown: 'Before\n' },
      { path: 'daily/2026-06-01.md', markdown: 'Bought milk\n' },
      { path: 'daily/2026-06-09.md', markdown: 'Standup\n' },
      { path: 'daily/2026-06-15.md', markdown: '\n' },
      { path: 'daily/2026-06-30.md', markdown: 'Last day\n' },
      { path: 'daily/2026-07-01.md', markdown: 'After\n' },
    ])

    await expect(dailyDatesInRange('2026-06-01', '2026-06-30')).resolves.toEqual([
      '2026-06-01',
      '2026-06-09',
      '2026-06-30',
    ])
  })

  it('returns an empty list when no daily notes exist in the range', async () => {
    seedNotes(database, [{ path: 'daily/2026-06-01.md', markdown: 'Bought milk\n' }])
    await expect(dailyDatesInRange('2025-01-01', '2025-01-31')).resolves.toEqual([])
  })
})

describe('getWikiAddressForPath', () => {
  it('uses the note_keys winner for the canonical title address', async () => {
    const database = seeded([{ path: 'notes/ada.md', markdown: '# Ada Lovelace\n' }])

    await expect(
      createWikiResolverService({ database }).getWikiAddressForPath('notes/ada.md'),
    ).resolves.toMatchObject({
      path: 'notes/ada.md',
      title: 'Ada Lovelace',
      insertText: 'Ada Lovelace',
    })
  })

  it('rescues an ambiguous title with a unique alias', async () => {
    const database = seeded([
      { path: 'notes/ada.md', markdown: '---\naliases: [Augusta Ada King]\n---\n# Ada Lovelace\n' },
      { path: 'notes/ada-2.md', markdown: '# Ada Lovelace\n' },
    ])

    await expect(
      createWikiResolverService({ database }).getWikiAddressForPath('notes/ada.md'),
    ).resolves.toMatchObject({
      path: 'notes/ada.md',
      alias: 'Augusta Ada King',
      insertText: 'Augusta Ada King',
    })
  })

  it('returns null when the path is absent or a template', async () => {
    const database = seeded([{ path: 'templates/journal.md', markdown: '# Journal\n' }])
    const wikiResolver = createWikiResolverService({ database })

    await expect(wikiResolver.getWikiAddressForPath('notes/missing.md')).resolves.toBeNull()
    await expect(wikiResolver.getWikiAddressForPath('templates/journal.md')).resolves.toBeNull()
  })
})

describe('resolveWikiTarget', () => {
  it('resolves through the canonical note_keys winner map in one query', async () => {
    const database = seeded([
      { path: 'notes/alias.md', markdown: '---\naliases: [Dad]\n---\n# Father\n' },
      { path: 'notes/winner.md', markdown: '# Dad\n' },
    ])

    await expect(
      createWikiResolverService({ database }).resolveWikiTarget('  DAD  '),
    ).resolves.toEqual({ kind: 'resolved', ref: 'notes/winner.md' })
    expect(database.getQueries()).toHaveLength(1)
  })

  it('preserves trimmed text when the canonical address is unresolved', async () => {
    const database = seeded([{ path: 'notes/winner.md', markdown: '# Dad\n' }])

    await expect(
      createWikiResolverService({ database }).resolveWikiTarget('  Missing  '),
    ).resolves.toEqual({ kind: 'unresolved', text: 'Missing' })
  })

  it('short-circuits a blank target before querying the index', async () => {
    const database = createTestDatabaseService()

    await expect(createWikiResolverService({ database }).resolveWikiTarget('   ')).resolves.toEqual(
      { kind: 'unresolved', text: '' },
    )
    expect(database.getQueries()).toEqual([])
  })
})

describe('findWikiTargetMatch', () => {
  it('returns the winning tier in one indexed read, preserving ambiguity', async () => {
    const database = seeded([
      { path: 'notes/business-ideas.md', markdown: '# Business Ideas\n' },
      { path: 'notes/business-ideas-2.md', markdown: '# Business Ideas\n' },
      { path: 'notes/plans.md', markdown: '---\naliases: [Business Ideas]\n---\n# Plans\n' },
    ])

    await expect(
      createWikiResolverService({ database }).findWikiTargetMatch('business ideas'),
    ).resolves.toEqual({
      tier: 2,
      paths: ['notes/business-ideas-2.md', 'notes/business-ideas.md'],
    })
    expect(database.getQueries()).toHaveLength(1)
  })

  it('reports an unclaimed key as tier 0 and never queries when the key is blank', async () => {
    const database = createTestDatabaseService()
    const wikiResolver = createWikiResolverService({ database })

    await expect(wikiResolver.findWikiTargetMatch('missing')).resolves.toEqual({
      tier: 0,
      paths: [],
    })
    await expect(wikiResolver.findWikiTargetMatch('')).resolves.toEqual({ tier: 0, paths: [] })
    expect(database.getQueries()).toHaveLength(1)
  })

  it('reads a daily-date claim from the same table as every other tier', async () => {
    const database = seeded([{ path: 'daily/2026-06-09.md', markdown: 'Standup\n' }])

    await expect(
      createWikiResolverService({ database }).findWikiTargetMatch('2026-06-09'),
    ).resolves.toEqual({ tier: 1, paths: ['daily/2026-06-09.md'] })
  })
})

describe('findNotesByPathKey', () => {
  it('selects by the folded path and never queries a blank key', async () => {
    const database = seeded([
      { path: 'Projects/Plan.md', markdown: '# Plan\n' },
      { path: 'notes/plan.md', markdown: '# Plan\n' },
    ])
    const wikiResolver = createWikiResolverService({ database })

    await expect(wikiResolver.findNotesByPathKey('projects/plan.md')).resolves.toEqual([
      'Projects/Plan.md',
    ])
    await expect(wikiResolver.findNotesByPathKey('')).resolves.toEqual([])
    expect(database.getQueries()).toHaveLength(1)
  })
})

describe('getLinkSources and getPathLinkSources', () => {
  it('list distinct sources by folded target key and by folded target path', async () => {
    const database = seeded([
      { path: 'notes/target.md', markdown: '# Target\n' },
      { path: 'notes/b.md', markdown: '[[Target]] and [[target]]\n' },
      { path: 'notes/a.md', markdown: '[[TARGET]]\n' },
      { path: 'notes/c.md', markdown: '[[notes/target]]\n' },
    ])
    const wikiResolver = createWikiResolverService({ database })

    await expect(wikiResolver.getLinkSources('target')).resolves.toEqual([
      'notes/a.md',
      'notes/b.md',
    ])
    await expect(wikiResolver.getPathLinkSources('notes/target.md')).resolves.toEqual([
      'notes/c.md',
    ])
  })
})

describe('listDailyNotes', () => {
  afterEach(() => {
    setDefaultDatabase(null)
  })

  it('selects public dailies in the inclusive range, most recent first, capped', async () => {
    setDefaultDatabase(
      seeded([
        { path: 'daily/2026-06-01.md', markdown: 'Older.\n', mtime: 1000 },
        { path: 'daily/2026-06-09.md', markdown: 'Stand-up notes.\n', mtime: 2000 },
        { path: 'daily/2026-06-10.md', markdown: '---\nprivate: true\n---\nSecret.\n' },
        { path: 'daily/2026-07-01.md', markdown: 'Out of range.\n' },
        { path: 'notes/a.md', markdown: '# A\n' },
      ]),
    )

    await expect(
      listDailyNotes({ start: '2026-06-01', end: '2026-06-30', limit: 1 }),
    ).resolves.toEqual([
      {
        path: 'daily/2026-06-09.md',
        title: '2026-06-09',
        dailyDate: '2026-06-09',
        preview: 'Stand-up notes.',
        mtime: 2000,
        isPrivate: false,
      },
    ])
    await expect(
      listDailyNotes({ start: '2026-06-01', end: '2026-06-30', limit: 32 }),
    ).resolves.toMatchObject([{ path: 'daily/2026-06-09.md' }, { path: 'daily/2026-06-01.md' }])
  })

  it('returns an empty list when no daily notes exist in the range', async () => {
    setDefaultDatabase(seeded([{ path: 'daily/2026-06-01.md', markdown: 'Older.\n' }]))
    await expect(
      listDailyNotes({ start: '2025-01-01', end: '2025-01-31', limit: 32 }),
    ).resolves.toEqual([])
  })
})

describe('getBacklinksWithContext', () => {
  function setup(notes: readonly TestNote[]): {
    database: TestDatabaseService
    backlinks: BacklinkService
    reads: string[]
  } {
    const database = seeded(notes)
    const files = createTestNoteFileService({
      files: Object.fromEntries(notes.map((note) => [note.path, note.markdown])),
    })
    const reads: string[] = []
    const noteFile: NoteFileService = {
      ...files,
      read: async (path, generation) => {
        reads.push(path)
        return await files.read(path, generation)
      },
    }
    return { database, backlinks: createBacklinkService({ database, noteFile }), reads }
  }

  it('pages complete sources in deterministic recency order and reads only included sources', async () => {
    const { backlinks, reads } = setup([
      { path: 'notes/target.md', markdown: '# target\n' },
      { path: 'daily/2026-07-01.md', markdown: 'daily [[target]]\n', mtime: 1 },
      { path: 'notes/older.md', markdown: 'older [[target]]\n', mtime: 1_000 },
      { path: 'notes/not-loaded.md', markdown: 'extra [[target]]\n', mtime: 500 },
      { path: 'notes/unrelated.md', markdown: 'no links\n', mtime: 5_000 },
    ])

    const page = await backlinks.getBacklinksWithContext('notes/target.md', {
      cursor: null,
      limit: 2,
    })

    expect(page.contexts).toEqual([
      {
        sourcePath: 'daily/2026-07-01.md',
        sourceTitle: '2026-07-01',
        snippet: 'daily [[target]]',
        posFrom: 6,
        tasks: [],
      },
      {
        sourcePath: 'notes/older.md',
        sourceTitle: 'older',
        snippet: 'older [[target]]',
        posFrom: 6,
        tasks: [],
      },
    ])
    expect(page.nextCursor).toEqual({ recencyMs: 1_000, sourcePath: 'notes/older.md' })
    expect(page.indexedLinkCount).toBe(3)
    expect(reads.toSorted()).toEqual(['daily/2026-07-01.md', 'notes/older.md'])
  })

  it('uses the recency/path keyset after a cursor and returns null at the end', async () => {
    const { backlinks } = setup([
      { path: 'notes/target.md', markdown: '# target\n' },
      { path: 'notes/newer.md', markdown: 'newer [[target]]\n', mtime: 2_000 },
      { path: 'notes/previous.md', markdown: 'previous [[target]]\n', mtime: 1_000 },
      { path: 'notes/sibling.md', markdown: 'sibling [[target]]\n', mtime: 1_000 },
      { path: 'notes/next.md', markdown: 'next [[target]]\n', mtime: 900 },
    ])

    const first = await backlinks.getBacklinksWithContext('notes/target.md', {
      cursor: { recencyMs: 1_000, sourcePath: 'notes/previous.md' },
      limit: 1,
    })
    expect(first.contexts.map((context) => context.sourcePath)).toEqual(['notes/sibling.md'])
    expect(first.nextCursor).toEqual({ recencyMs: 1_000, sourcePath: 'notes/sibling.md' })

    const second = await backlinks.getBacklinksWithContext('notes/target.md', {
      cursor: first.nextCursor,
      limit: 1,
    })
    expect(second.contexts.map((context) => context.sourcePath)).toEqual(['notes/next.md'])
    expect(second.nextCursor).toBeNull()
    expect(second.indexedLinkCount).toBe(4)
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid page limit (%s) before querying',
    async (limit) => {
      const { database, backlinks } = setup([])
      await expect(
        backlinks.getBacklinksWithContext('notes/target.md', { cursor: null, limit }),
      ).rejects.toThrow('positive safe integer')
      expect(database.getQueries()).toEqual([])
    },
  )

  it('extracts the block context around the link — a list item keeps its children', async () => {
    const { backlinks } = setup([
      { path: 'notes/target.md', markdown: '# target\n' },
      {
        path: 'notes/source.md',
        markdown: '- kickoff with [[target]]\n  - prep the agenda\n- unrelated\n',
      },
    ])

    const page = await backlinks.getBacklinksWithContext('notes/target.md', {
      cursor: null,
      limit: 10,
    })

    expect(page.contexts.map((row) => row.snippet)).toEqual([
      '- kickoff with [[target]]\n  - prep the agenda',
    ])
  })

  it('co-groups sibling branches through the target aliases, not just the clicked spelling', async () => {
    const { backlinks } = setup([
      { path: 'notes/target.md', markdown: '---\naliases: [projx]\n---\n# Project X\n' },
      {
        path: 'notes/source.md',
        markdown: '- parent line\n  - one [[Project X]]\n  - two [[projx]]\n',
      },
    ])

    const page = await backlinks.getBacklinksWithContext('notes/target.md', {
      cursor: null,
      limit: 10,
    })

    expect(page.contexts.map((row) => row.snippet)).toEqual([
      '- parent line\n  - one [[Project X]]\n  - two [[projx]]',
    ])
    expect(page.indexedLinkCount).toBe(2)
  })

  it('deduplicates a complete source while reporting the raw indexed link count', async () => {
    const { backlinks } = setup([
      { path: 'notes/target.md', markdown: '# target\n' },
      {
        path: 'notes/source.md',
        markdown: 'both [[target]] links on one [[target]] line\n\nanother [[target]] mention\n',
      },
    ])

    const page = await backlinks.getBacklinksWithContext('notes/target.md', {
      cursor: null,
      limit: 1,
    })

    expect(page.contexts.map((row) => row.snippet)).toEqual([
      'both [[target]] links on one [[target]] line',
      'another [[target]] mention',
    ])
    expect(page.indexedLinkCount).toBe(3)
  })

  it('keeps a source that vanished from disk with an empty snippet', async () => {
    const database = seeded([
      { path: 'notes/target.md', markdown: '# target\n' },
      { path: 'notes/gone.md', markdown: 'gone [[target]]\n' },
    ])
    const backlinks = createBacklinkService({ database, noteFile: createTestNoteFileService() })

    const page = await backlinks.getBacklinksWithContext('notes/target.md', {
      cursor: null,
      limit: 10,
    })

    expect(page.contexts).toEqual([
      { sourcePath: 'notes/gone.md', sourceTitle: 'gone', snippet: '', posFrom: 5, tasks: [] },
    ])
  })
})

describe('getBacklinks', () => {
  it('lists the raw resolved links into a note, by source path', async () => {
    const database = seeded([
      { path: 'notes/target.md', markdown: '---\naliases: [T]\n---\n# Target\n' },
      { path: 'notes/b.md', markdown: '[[Target]]\n' },
      { path: 'notes/a.md', markdown: 'x [[T|the target]]\n' },
      { path: 'notes/c.md', markdown: '[[Other]]\n' },
    ])
    const backlinks = createBacklinkService({ database, noteFile: createTestNoteFileService() })

    await expect(backlinks.getBacklinks('notes/target.md')).resolves.toEqual([
      { sourcePath: 'notes/a.md', targetRaw: 'T', alias: 'the target', posFrom: 2, posTo: 18 },
      { sourcePath: 'notes/b.md', targetRaw: 'Target', alias: null, posFrom: 0, posTo: 10 },
    ])
  })
})

describe('getPinnedNotes', () => {
  it('lists pinned rows: explicit orders first, then folded title, never templates', async () => {
    const database = seeded([
      { path: 'notes/b.md', markdown: '---\npinned: true\n---\n# Beta\n' },
      { path: 'notes/c.md', markdown: '---\npinned: true\n---\n# aardvark\n' },
      { path: 'notes/a.md', markdown: '---\npinned: 0\n---\n# Alpha\n' },
      { path: 'notes/d.md', markdown: '---\npinned: 3\n---\n# Delta\n' },
      { path: 'notes/unpinned.md', markdown: '# Unpinned\n' },
      { path: 'templates/pinned.md', markdown: '---\npinned: true\n---\n# Template\n' },
    ])

    await expect(createIndexQueryService({ database }).getPinnedNotes()).resolves.toEqual([
      { path: 'notes/a.md', title: 'Alpha', dailyDate: null, pinnedOrder: 0 },
      { path: 'notes/d.md', title: 'Delta', dailyDate: null, pinnedOrder: 3 },
      { path: 'notes/c.md', title: 'aardvark', dailyDate: null, pinnedOrder: null },
      { path: 'notes/b.md', title: 'Beta', dailyDate: null, pinnedOrder: null },
    ])
  })
})

describe('getNote', () => {
  it('maps the row flags to booleans, or resolves undefined when absent', async () => {
    const database = seeded([
      { path: 'notes/secret.md', markdown: '---\nprivate: true\n---\n# Secret\n' },
    ])
    const indexQuery = createIndexQueryService({ database })

    await expect(indexQuery.getNote('notes/secret.md')).resolves.toEqual({
      path: 'notes/secret.md',
      title: 'Secret',
      dailyDate: null,
      isPrivate: true,
      hasConflict: false,
      gistUrl: null,
      gistStale: false,
    })
    await expect(indexQuery.getNote('notes/missing.md')).resolves.toBeUndefined()
  })
})

describe('getDuplicateNoteIds', () => {
  it('returns empty without a second query when no id is duplicated', async () => {
    const database = seeded([
      { path: 'notes/a.md', markdown: '---\nid: one\n---\n# A\n' },
      { path: 'notes/b.md', markdown: '---\nid: two\n---\n# B\n' },
      { path: 'notes/c.md', markdown: '# C\n' },
    ])

    await expect(createIndexQueryService({ database }).getDuplicateNoteIds()).resolves.toEqual([])
    expect(database.getQueries()).toHaveLength(1)
  })

  it('groups every path claiming a duplicated id, ordered', async () => {
    const database = seeded([
      { path: 'notes/b.md', markdown: '---\nid: dup-1\n---\n# B\n' },
      { path: 'notes/a.md', markdown: '---\nid: dup-1\n---\n# A\n' },
      { path: 'notes/c.md', markdown: '---\nid: unique\n---\n# C\n' },
    ])

    await expect(createIndexQueryService({ database }).getDuplicateNoteIds()).resolves.toEqual([
      { id: 'dup-1', paths: ['notes/a.md', 'notes/b.md'] },
    ])
  })
})

describe('getNoteIdsByPath', () => {
  it('asks nothing for no paths', async () => {
    const database = createTestDatabaseService()
    await expect(createIndexQueryService({ database }).getNoteIdsByPath([])).resolves.toEqual(
      new Map(),
    )
    expect(database.getQueries()).toEqual([])
  })

  it('chunks the IN clause under SQLite variable limits and merges the results', async () => {
    // A mass external move can orphan thousands of paths in one reconcile —
    // a single statement would blow the bound-variable budget.
    const database = seeded([
      { path: 'notes/0.md', markdown: '---\nid: id-0\n---\n# Zero\n' },
      { path: 'notes/500.md', markdown: '---\nid: id-500\n---\n# Five hundred\n' },
      { path: 'notes/1000.md', markdown: '# No id\n' },
    ])
    const paths = Array.from({ length: 1200 }, (_, index) => `notes/${index}.md`)

    const ids = await createIndexQueryService({ database }).getNoteIdsByPath(paths)

    expect(database.getQueries().map((query) => query.params.length)).toEqual([500, 500, 200])
    expect(ids).toEqual(
      new Map([
        ['notes/0.md', 'id-0'],
        ['notes/500.md', 'id-500'],
        ['notes/1000.md', null],
      ]),
    )
  })
})

describe('getIndexedFileFactsByPath', () => {
  it('reads the stored hash and mtime of the indexed paths only', async () => {
    const database = seeded([{ path: 'notes/a.md', markdown: '# A\n', mtime: 42 }])

    await expect(
      createIndexQueryService({ database }).getIndexedFileFactsByPath(['notes/a.md', 'notes/b.md']),
    ).resolves.toEqual(new Map([['notes/a.md', { fileHash: 'hash-notes/a.md', mtime: 42 }]]))
  })
})

describe('suggestTags', () => {
  it('suggests tags containing the folded query, most-used first, never from templates', async () => {
    const database = seeded([
      { path: 'notes/a.md', markdown: '# A\n#Reading #ready\n' },
      { path: 'notes/b.md', markdown: '# B\n#reading\n' },
      { path: 'notes/c.md', markdown: '# C\n#unrelated #a_b #axb\n' },
      { path: 'templates/t.md', markdown: '# T\n#readme #readme-too\n' },
    ])
    const suggestions = createSuggestionService({ database })

    await expect(suggestions.suggestTags('READ')).resolves.toEqual([
      { tag: 'Reading', count: 2 },
      { tag: 'ready', count: 1 },
    ])
    await expect(suggestions.suggestTags('a_b')).resolves.toEqual([{ tag: 'a_b', count: 1 }])
    await expect(suggestions.suggestTags('', 1)).resolves.toEqual([{ tag: 'Reading', count: 2 }])
  })
})

describe('suggestWikiTargets', () => {
  // Wednesday, 1 January 2020, day/month — the date generator's worked-example
  // clock. This exercises the live glue (generator + merge) the editor hits;
  // the parts themselves are unit-tested in date-suggestions/suggest.
  const clock = { today: '2020-01-01', dateFormat: 'dmy' as const, weekStartDay: 'monday' as const }

  it('synthesises a daily target from a fuzzy query when given a clock', async () => {
    const database = createTestDatabaseService()

    await expect(
      createSuggestionService({ database }).suggestWikiTargets('3 days ago', 8, clock),
    ).resolves.toEqual([
      {
        target: '2019-12-29',
        path: null,
        title: '2019-12-29',
        alias: null,
        date: '2019-12-29',
        generated: { phrase: '3 days ago' },
      },
    ])
  })

  it('keeps an exact title match above the generated date (folded key threaded into the merge)', async () => {
    const database = seeded([{ path: 'notes/today.md', markdown: '# Today\n' }])

    const result = await createSuggestionService({ database }).suggestWikiTargets('today', 8, clock)

    expect(result.map((row) => row.target)).toEqual(['Today', '2020-01-01'])
    expect(result[0]!.path).toBe('notes/today.md')
    expect(result[1]).toMatchObject({
      date: '2020-01-01',
      generated: { phrase: 'Today' },
      path: null,
    })
  })

  it('does not synthesise dates without a clock', async () => {
    const database = createTestDatabaseService()
    await expect(
      createSuggestionService({ database }).suggestWikiTargets('today'),
    ).resolves.toEqual([])
  })

  it('still injects the bare daily for a full ISO query without a clock', async () => {
    const database = createTestDatabaseService()
    await expect(
      createSuggestionService({ database }).suggestWikiTargets('2020-01-01'),
    ).resolves.toEqual([
      { target: '2020-01-01', path: null, title: '2020-01-01', alias: null, date: '2020-01-01' },
    ])
  })

  it('excludes templates from both the title and alias candidates', async () => {
    const database = seeded([
      { path: 'templates/journal.md', markdown: '---\naliases: [Journal alias]\n---\n# Journal\n' },
      { path: 'notes/journal-log.md', markdown: '# Journal log\n' },
    ])

    const result = await createSuggestionService({ database }).suggestWikiTargets('journal')

    expect(result.map((row) => row.path)).toEqual(['notes/journal-log.md'])
  })
})
