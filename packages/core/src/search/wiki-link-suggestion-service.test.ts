import { describe, expect, it } from 'vitest'
import type { ContactMatch, ContactsAuthorization } from '../contacts/contacts-service.ts'
import type { EnsurePersonNoteInput, PersonContactResolution } from '../contacts/person.ts'
import type { ResolveOrCreateNoteResult } from '../graph/note-creation-service.ts'
import type { DateSuggestionContext } from '../indexing/date-suggestion-types.ts'
import type { WikiLinkSuggestionResult } from '../indexing/suggestion-service.ts'
import type { Settings } from '../settings/schema.ts'
import { createTestClockService } from '../testing/clock.ts'
import { createTestDatabaseService, seedNotes } from '../testing/database.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import { createTestOperationsService } from '../testing/operations.ts'
import { createTestWikiLinkSuggestionService } from '../testing/search.ts'
import { createTestSettingsService } from '../testing/settings.ts'
import type { WikiLinkPersonNotes } from './wiki-link-suggestion-service.ts'

const NO_SUGGESTIONS: WikiLinkSuggestionResult = {
  suggestions: [],
  claimedTargetKeys: [],
  queryReadsAsDate: false,
}

const ADA: ContactMatch = {
  fullName: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  emails: ['ada@example.com'],
  phones: [],
}

interface SetupOptions {
  settings?: Partial<Settings>
  wikiLinks?: WikiLinkSuggestionResult
  /** Answers `resolveOrCreateNoteWithTitle`. */
  create?: () => Promise<ResolveOrCreateNoteResult>
  personNotes?: Partial<WikiLinkPersonNotes>
}

async function setup(options?: SetupOptions) {
  const operations = createTestOperationsService()
  const logger = createTestLoggerService()
  const settings = createTestSettingsService(options?.settings ?? {}, { operations })
  await settings.whenLoaded()
  const clock = createTestClockService({ now: new Date(2026, 5, 9, 12).getTime() })
  const linkQueries: { query: string; limit?: number; dateGen?: DateSuggestionContext }[] = []
  const tagQueries: string[] = []
  const created: { title: string; generation: number; body?: string }[] = []
  const ensured: EnsurePersonNoteInput[] = []
  const service = createTestWikiLinkSuggestionService({
    suggestions: {
      suggestWikiLinkTargets: async (query, limit, dateGen) => {
        linkQueries.push({
          query,
          ...(limit === undefined ? {} : { limit }),
          ...(dateGen === undefined ? {} : { dateGen }),
        })
        return options?.wikiLinks ?? NO_SUGGESTIONS
      },
      suggestTags: async (query) => {
        tagQueries.push(query)
        return [
          { tag: 'work', count: 3 },
          { tag: 'Home', count: 1 },
        ]
      },
    },
    noteCreation: {
      resolveOrCreateNoteWithTitle: async (title, generation, body) => {
        created.push({ title, generation, ...(body === undefined ? {} : { body }) })
        return await (options?.create?.() ??
          Promise.resolve({ kind: 'created', path: 'notes/created.md' }))
      },
    },
    personNotes: {
      contactLinkSuggestions: async () => [],
      resolvePersonContact: async (contact) => ({
        kind: 'new',
        contact,
        insertText: contact.fullName,
      }),
      ensurePersonNote: async (input) => {
        ensured.push(input)
        return { kind: 'created', path: 'notes/person.md' }
      },
      ...options?.personNotes,
    },
    settings,
    clock,
    operations,
    logger,
  })
  const suggest = (query: string, contactsAuthorization: ContactsAuthorization | null = null) =>
    service.suggestLinks(query, { generation: 7, contactsAuthorization })
  return { service, suggest, operations, logger, linkQueries, tagQueries, created, ensured }
}

/** Let the background work of an `onSelect` settle. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn++) {
    await Promise.resolve()
  }
}

describe('WikiLinkSuggestionService.suggestLinks', () => {
  it('asks the index for 8 link targets, with the date context of the settings and the clock', async () => {
    const { suggest, linkQueries } = await setup({
      settings: { dateFormat: 'dmy', weekStartDay: 'sunday' },
    })
    await suggest('road')
    expect(linkQueries).toEqual([
      {
        query: 'road',
        limit: 8,
        dateGen: { today: '2026-06-09', dateFormat: 'dmy', weekStartDay: 'sunday' },
      },
    ])
  })

  it('does not offer create when the exact query has an unaddressable claim', async () => {
    const { suggest } = await setup({
      wikiLinks: { suggestions: [], claimedTargetKeys: ['roadmap'], queryReadsAsDate: false },
    })
    await expect(suggest('Roadmap')).resolves.toEqual([])
  })

  it('reports an ambiguous background create instead of silently doing nothing', async () => {
    const { suggest, operations, created } = await setup({
      create: async () => ({
        kind: 'ambiguous',
        paths: ['notes/business-ideas.md', 'notes/business-ideas-2.md'],
      }),
    })
    const items = await suggest('Business ideas')
    expect(items).toMatchObject([{ target: 'Business ideas', label: 'Create “Business ideas”' }])

    items[0]!.onSelect?.()
    await settle()

    expect(created).toEqual([{ title: 'Business ideas', generation: 7 }])
    expect(operations.findByLabel('Creating note')).toMatchObject({
      status: 'failed',
      message:
        'Couldn’t safely choose one note matching “Business ideas”. Rename conflicting notes or wait for unavailable notes to become available, then try again.',
    })
  })

  it('reports an unavailable background create distinctly from ambiguity', async () => {
    const { suggest, operations, created } = await setup({
      create: async () => ({ kind: 'unavailable', paths: ['notes/business-ideas.md'] }),
    })
    const items = await suggest('Business ideas')

    items[0]!.onSelect?.()
    await settle()

    expect(created).toEqual([{ title: 'Business ideas', generation: 7 }])
    expect(operations.findByLabel('Creating note')).toMatchObject({
      status: 'failed',
      message:
        'Couldn’t create “Business ideas” while a potentially matching note is unavailable. Try again when it is available on this device.',
    })
  })

  it('surfaces a failed background create instead of silently doing nothing', async () => {
    const cause = new Error('graph changed')
    const { suggest, operations, logger } = await setup({ create: () => Promise.reject(cause) })
    const items = await suggest('Business ideas')

    items[0]!.onSelect?.()
    await settle()

    expect(operations.findByLabel('Creating note')).toMatchObject({
      status: 'failed',
      message: 'graph changed',
    })
    expect(logger.getErrors()).toEqual([{ message: 'create-from-autocomplete failed:', cause }])
  })

  it('creates in the background without user-facing feedback on the happy path', async () => {
    const { suggest, operations, created, logger } = await setup()
    const items = await suggest('Business ideas')

    items[0]!.onSelect?.()
    await settle()

    expect(created).toEqual([{ title: 'Business ideas', generation: 7 }])
    expect(operations.getAll()).toEqual([])
    expect(logger.getErrors()).toEqual([])
  })

  it('labels a `//` note by its first segment and details only an informative alias', async () => {
    const { suggest } = await setup({
      wikiLinks: {
        suggestions: [
          {
            target: 'Tim MacCaw // Dad',
            path: 'notes/tim-maccaw-dad.md',
            title: 'Tim MacCaw // Dad',
            alias: 'Dad',
            date: null,
            insertText: 'Tim MacCaw // Dad|Dad',
          },
          {
            target: 'Charlotte MacCaw // Mum',
            path: 'notes/charlotte-maccaw-mum.md',
            title: 'Charlotte MacCaw // Mum',
            alias: 'Charlotte MacCaw',
            date: null,
            insertText: 'Charlotte MacCaw // Mum|Charlotte MacCaw',
          },
        ],
        claimedTargetKeys: [],
        queryReadsAsDate: false,
      },
    })

    const items = await suggest('maccaw')
    expect(items.slice(0, 2)).toMatchObject([
      { target: 'Tim MacCaw // Dad|Dad', label: 'Tim MacCaw', detail: 'Dad → Tim MacCaw' },
      { target: 'Charlotte MacCaw // Mum|Charlotte MacCaw', label: 'Charlotte MacCaw' },
    ])
    expect(items[1]).not.toHaveProperty('detail')
  })

  it('details notes that share a title with their paths', async () => {
    const { suggest } = await setup({
      wikiLinks: {
        suggestions: [
          {
            target: 'Event loop',
            path: 'notes/event-loop.md',
            title: 'Event loop',
            alias: null,
            date: null,
            insertText: 'notes/event-loop',
          },
          {
            target: 'Event loop',
            path: 'notes/event-loop-2.md',
            title: 'Event loop',
            alias: null,
            date: null,
            insertText: 'notes/event-loop-2',
          },
          {
            target: 'Event sourcing',
            path: 'notes/event-sourcing.md',
            title: 'Event sourcing',
            alias: null,
            date: null,
            insertText: 'Event sourcing',
          },
        ],
        claimedTargetKeys: [],
        queryReadsAsDate: false,
      },
    })

    const items = await suggest('event')
    expect(items.slice(0, 3)).toMatchObject([
      { target: 'notes/event-loop', label: 'Event loop', detail: 'notes/event-loop.md' },
      { target: 'notes/event-loop-2', label: 'Event loop', detail: 'notes/event-loop-2.md' },
      { target: 'Event sourcing', label: 'Event sourcing' },
    ])
    expect(items[2]).not.toHaveProperty('detail')
  })

  it('labels daily notes and generated dates per the date-format setting', async () => {
    const { suggest } = await setup({
      wikiLinks: {
        suggestions: [
          {
            target: '2026-06-12',
            path: null,
            title: '2026-06-12',
            alias: null,
            date: '2026-06-12',
            insertText: '2026-06-12',
            generated: { phrase: 'Next Friday' },
          },
          {
            target: '2026-06-08',
            path: 'daily/2026-06-08.md',
            title: '2026-06-08',
            alias: null,
            date: '2026-06-08',
            insertText: '2026-06-08',
          },
          {
            target: '2026-06-07',
            path: null,
            title: '2026-06-07',
            alias: null,
            date: '2026-06-07',
            insertText: '2026-06-07',
          },
        ],
        claimedTargetKeys: [],
        queryReadsAsDate: true,
      },
    })

    await expect(suggest('next friday')).resolves.toEqual([
      { target: '2026-06-12', label: 'Next Friday', detail: 'Fri, June 12th, 2026' },
      { target: '2026-06-08', label: 'Mon, June 8th, 2026', detail: '2026-06-08' },
      { target: '2026-06-07', label: 'Sun, June 7th, 2026', detail: '2026-06-07 · new' },
    ])
  })

  it('uses an existing email owner as the Contact row target', async () => {
    const existing: PersonContactResolution = {
      kind: 'existing',
      contact: ADA,
      emails: ['ada@example.com'],
      path: 'notes/augusta.md',
      title: 'Augusta Ada King',
      insertText: 'Augusta Ada King',
    }
    const { suggest, ensured } = await setup({
      settings: { contactsEnabled: true },
      personNotes: {
        contactLinkSuggestions: async () => [ADA],
        resolvePersonContact: async () => existing,
      },
    })

    const items = await suggest('Ada', 'authorized')
    expect(items).toMatchObject([
      { target: 'Augusta Ada King', label: 'Ada Lovelace', detail: 'ada@example.com' },
      { target: 'Ada', label: 'Create “Ada”' },
    ])

    items[0]!.onSelect?.()
    await settle()
    expect(ensured).toEqual([
      {
        title: 'Ada Lovelace',
        emails: ['ada@example.com'],
        body: '- Type: #person\n- Email: ada@example.com',
        generation: 7,
      },
    ])
  })

  it('hides an exact blocked Contact and its Create fallback', async () => {
    const { suggest } = await setup({
      settings: { contactsEnabled: true },
      personNotes: {
        contactLinkSuggestions: async () => [ADA],
        resolvePersonContact: async (contact) => ({
          kind: 'blocked',
          contact,
          reason: 'identity-conflict',
        }),
      },
    })

    await expect(suggest('Ada Lovelace', 'authorized')).resolves.toEqual([])
  })

  it('reports a failed Contact creation through the operation UI', async () => {
    const cause = new Error('graph changed')
    const { suggest, operations, logger } = await setup({
      settings: { contactsEnabled: true },
      personNotes: {
        contactLinkSuggestions: async () => [ADA],
        ensurePersonNote: () => Promise.reject(cause),
      },
    })
    const items = await suggest('Ada Lovelace', 'authorized')

    items[0]!.onSelect?.()
    await settle()

    expect(operations.snapshot()).toContainEqual(
      expect.objectContaining({
        label: 'Creating note',
        status: 'failed',
        message: 'graph changed',
      }),
    )
    expect(logger.getErrors()).toEqual([{ message: 'create-person-note failed:', cause }])
  })

  it('reports an ambiguous or unavailable Contact creation', async () => {
    const outcomes: ResolveOrCreateNoteResult[] = [
      { kind: 'ambiguous', paths: ['notes/ada.md', 'notes/ada-2.md'] },
      { kind: 'unavailable', paths: ['notes/ada.md'] },
    ]
    const { suggest, operations } = await setup({
      settings: { contactsEnabled: true },
      personNotes: {
        contactLinkSuggestions: async () => [ADA],
        ensurePersonNote: async () => outcomes.shift()!,
      },
    })
    const items = await suggest('Ada Lovelace', 'authorized')

    items[0]!.onSelect?.()
    items[0]!.onSelect?.()
    await settle()

    expect(operations.snapshot().map((operation) => operation.message)).toEqual([
      'Couldn’t safely choose one note matching “Ada Lovelace”. Rename conflicting notes or wait for unavailable notes to become available, then try again.',
      'Couldn’t create “Ada Lovelace” while a potentially matching note is unavailable. Try again when it is available on this device.',
    ])
  })

  it('keeps contacts out of the menu unless the integration is on and readable', async () => {
    let lookups = 0
    const personNotes: Partial<WikiLinkPersonNotes> = {
      contactLinkSuggestions: async () => {
        lookups++
        return [ADA]
      },
    }
    const off = await setup({ settings: { contactsEnabled: false }, personNotes })
    await expect(off.suggest('Ada Lovelace', 'authorized')).resolves.toMatchObject([
      { label: 'Create “Ada Lovelace”' },
    ])

    const on = await setup({ settings: { contactsEnabled: true }, personNotes })
    await expect(on.suggest('Ada Lovelace', null)).resolves.toMatchObject([
      { label: 'Create “Ada Lovelace”' },
    ])
    await expect(on.suggest('Ada Lovelace', 'denied')).resolves.toMatchObject([
      { label: 'Create “Ada Lovelace”' },
    ])
    expect(lookups).toBe(0)

    await expect(on.suggest('Ada Lovelace', 'limited')).resolves.toMatchObject([
      { label: 'Ada Lovelace', detail: 'ada@example.com' },
    ])
    expect(lookups).toBe(1)
  })

  it('a contacts failure costs only the Contact rows', async () => {
    const cause = new Error('contacts store unavailable')
    const { suggest, logger } = await setup({
      settings: { contactsEnabled: true },
      wikiLinks: {
        suggestions: [
          {
            target: 'Ada notes',
            path: 'notes/ada-notes.md',
            title: 'Ada notes',
            alias: null,
            date: null,
            insertText: 'Ada notes',
          },
        ],
        claimedTargetKeys: [],
        queryReadsAsDate: false,
      },
      personNotes: { contactLinkSuggestions: () => Promise.reject(cause) },
    })

    await expect(suggest('Ada', 'authorized')).resolves.toMatchObject([
      { target: 'Ada notes', label: 'Ada notes' },
      { target: 'Ada', label: 'Create “Ada”' },
    ])
    expect(logger.getErrors()).toEqual([{ message: 'contact link suggestions failed:', cause }])
  })

  it('ranks suggestions from the index and creates the note behind the Create row', async () => {
    const database = createTestDatabaseService()
    seedNotes(database, [
      { path: 'notes/roadmap.md', markdown: '# Roadmap\n' },
      { path: 'notes/road-trip.md', markdown: '# Road trip\n' },
    ])
    const service = createTestWikiLinkSuggestionService({ database })

    const items = await service.suggestLinks('road', { generation: 1, contactsAuthorization: null })
    expect(items.map((item) => item.label)).toEqual(['Road trip', 'Roadmap', 'Create “road”'])
    database.close()
  })
})

describe('WikiLinkSuggestionService.suggestTags', () => {
  it('maps the index suggestions to tag rows, in order', async () => {
    const { service, tagQueries } = await setup()
    await expect(service.suggestTags('o')).resolves.toEqual([{ tag: 'work' }, { tag: 'Home' }])
    expect(tagQueries).toEqual(['o'])
  })
})
