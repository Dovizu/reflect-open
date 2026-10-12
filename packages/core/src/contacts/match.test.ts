import { afterEach, describe, expect, it } from 'vitest'
import { createTestContactsService } from '../testing/contacts.ts'
import type { ContactMatch } from './commands.ts'
import { setDefaultContacts } from './contacts-service.ts'
import {
  contactLinkSuggestions,
  contactNamesEqual,
  matchContactForTitle,
  suggestContactForTitle,
} from './match.ts'

function contact(overrides: Partial<ContactMatch>): ContactMatch {
  return {
    fullName: '',
    givenName: '',
    familyName: '',
    emails: [],
    phones: [],
    ...overrides,
  }
}

afterEach(() => {
  setDefaultContacts(null)
})

describe('matchContactForTitle', () => {
  it('matches a title that exactly equals a full name', () => {
    const ada = contact({ fullName: 'Ada Lovelace' })
    expect(matchContactForTitle('Ada Lovelace', [ada])).toBe(ada)
  })

  it('is case-insensitive and whitespace-collapsing', () => {
    const ada = contact({ fullName: 'Ada Lovelace' })
    expect(matchContactForTitle('  ada   lovelace ', [ada])).toBe(ada)
  })

  it('compares unicode-normalized names (composed vs decomposed accents)', () => {
    const rene = contact({ fullName: 'René Descartes' })
    expect(matchContactForTitle('René Descartes', [rene])).toBe(rene)
  })

  it('is diacritic-insensitive, matching the framework predicate that fed it', () => {
    const rene = contact({ fullName: 'René Descartes' })
    expect(matchContactForTitle('Rene Descartes', [rene])).toBe(rene)
    const zoe = contact({ fullName: 'Zoe Muller' })
    expect(matchContactForTitle('Zoë Müller', [zoe])).toBe(zoe)
  })

  it('rejects the word-prefix hits the framework predicate returns', () => {
    const ada = contact({ fullName: 'Ada Lovelace' })
    expect(matchContactForTitle('Ada', [ada])).toBeNull()
    expect(matchContactForTitle('Ada Lovelace Fan Club', [ada])).toBeNull()
  })

  it('never matches blank titles or nameless contacts', () => {
    const nameless = contact({ emails: ['x@example.com'] })
    expect(matchContactForTitle('', [nameless])).toBeNull()
    expect(matchContactForTitle('   ', [nameless])).toBeNull()
    expect(matchContactForTitle('x@example.com', [nameless])).toBeNull()
  })

  it('prefers the exact match carrying the most detail', () => {
    const empty = contact({ fullName: 'Ada Lovelace' })
    const detailed = contact({
      fullName: 'Ada Lovelace',
      emails: ['ada@example.com'],
      phones: ['+1 555 0100'],
    })
    expect(matchContactForTitle('Ada Lovelace', [empty, detailed])).toBe(detailed)
  })
})

describe('contactNamesEqual', () => {
  it('compares names under the matching rule (case, diacritics, whitespace)', () => {
    expect(contactNamesEqual('Ada Lovelace', 'ada  lovelace')).toBe(true)
    expect(contactNamesEqual('René Descartes', 'Rene Descartes')).toBe(true)
    expect(contactNamesEqual('Ada Lovelace', 'Grace Hopper')).toBe(false)
    expect(contactNamesEqual('', '')).toBe(false)
  })
})

describe('contactLinkSuggestions', () => {
  const ada = {
    fullName: 'Ada Lovelace',
    givenName: 'Ada',
    familyName: 'Lovelace',
    emails: ['ada@example.com'],
    phones: [],
  }

  it('answers empty for short queries without a lookup', async () => {
    const contacts = createTestContactsService({ contacts: [ada] })
    setDefaultContacts(contacts)
    await expect(contactLinkSuggestions('a')).resolves.toEqual([])
    expect(contacts.lookups()).toEqual([])
  })

  it('keeps word-prefix matches, dropping nameless and detail-less contacts', async () => {
    const contacts = createTestContactsService({
      contacts: [
        ada,
        { fullName: '', givenName: 'Ada', familyName: '', emails: ['x@example.com'], phones: [] },
        { fullName: 'Ada Byron', givenName: 'Ada', familyName: 'Byron', emails: [], phones: [] },
      ],
    })
    setDefaultContacts(contacts)

    await expect(contactLinkSuggestions('Ada')).resolves.toEqual([ada])
    expect(contacts.lookups()).toEqual([{ kind: 'name', name: 'Ada' }])
  })

  it('dedupes same-named entries and honors the limit', async () => {
    const named = (index: number) => ({
      fullName: `Person ${index}`,
      givenName: 'Person',
      familyName: String(index),
      emails: [`p${index}@example.com`],
      phones: [],
    })
    setDefaultContacts(
      createTestContactsService({
        contacts: [
          named(1),
          { ...named(1), emails: ['dupe@example.com'] },
          named(2),
          named(3),
          named(4),
          named(5),
        ],
      }),
    )

    const suggestions = await contactLinkSuggestions('Person')
    expect(suggestions.map((entry) => entry.fullName)).toEqual([
      'Person 1',
      'Person 2',
      'Person 3',
      'Person 4',
    ])
  })
})

describe('suggestContactForTitle', () => {
  it('short-circuits blank titles without a lookup', async () => {
    const contacts = createTestContactsService()
    setDefaultContacts(contacts)
    await expect(suggestContactForTitle('  ')).resolves.toBeNull()
    expect(contacts.lookups()).toEqual([])
  })

  it('looks up the trimmed title and applies the exact-match rule', async () => {
    const contacts = createTestContactsService({
      contacts: [
        {
          fullName: 'Ada Lovelace',
          givenName: 'Ada',
          familyName: 'Lovelace',
          emails: ['ada@example.com'],
          phones: [],
        },
        { fullName: 'Ada Byron', givenName: 'Ada', familyName: 'Byron', emails: [], phones: [] },
      ],
    })
    setDefaultContacts(contacts)

    const match = await suggestContactForTitle(' Ada Lovelace ')
    expect(match?.emails).toEqual(['ada@example.com'])
    expect(contacts.lookups()).toEqual([{ kind: 'name', name: 'Ada Lovelace' }])
  })
})
