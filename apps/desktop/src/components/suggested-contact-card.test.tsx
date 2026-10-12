import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBridge, setDefaultContacts } from '@reflect/core'
import { createTestContactsService, type TestContactsService } from '@reflect/core/testing'
import { expectLocatorToHaveCount } from '@/test-utils/expect.ts'
import { SuggestedContactCard } from './suggested-contact-card.tsx'

// The card reads the graph (generation for writes) and the contacts opt-in;
// both providers are per-app plumbing the component test doesn't need.
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({ graph: { root: '/g', generation: 3 } }),
}))
const contactsEnabled = vi.hoisted(() => ({ current: true }))
vi.mock('@/providers/settings-provider.tsx', () => ({
  useSettings: () => ({ settings: { contactsEnabled: contactsEnabled.current } }),
}))

const ADA = {
  fullName: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  emails: ['ada@example.com'],
  phones: ['+1 555 0100'],
}

let noteSource: string
let written: Array<{ path: string; contents: string }>
let contacts: TestContactsService

function installFakeBridge(): void {
  written = []
  setBridge({
    invoke: async (command, args) => {
      switch (command) {
        case 'note_read':
          return noteSource
        case 'note_write': {
          const path = String(args['path'])
          const contents = String(args['contents'])
          written.push({ path, contents })
          noteSource = contents
          return null
        }
        default:
          throw new Error(`unexpected command ${command}`)
      }
    },
    listen: async () => () => {},
  })
}

async function renderCard(): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <QueryClientProvider client={queryClient}>
      <SuggestedContactCard path="notes/Ada Lovelace.md" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  contactsEnabled.current = true
  noteSource = '# Ada Lovelace\n'
  contacts = createTestContactsService({ contacts: [ADA] })
  setDefaultContacts(contacts)
  installFakeBridge()
})

afterEach(() => {
  setBridge(null)
  setDefaultContacts(null)
})

describe('SuggestedContactCard', () => {
  it('offers the matched contact with its primary details', async () => {
    await renderCard()
    await expect.element(page.getByText('Ada Lovelace')).toBeInTheDocument()
    await expect.element(page.getByText('ada@example.com · +1 555 0100')).toBeInTheDocument()
    expect(contacts.lookups()).toEqual([{ kind: 'name', name: 'Ada Lovelace' }])
  })

  it('Add writes the details block in one write, then the content hides the card', async () => {
    await renderCard()
    await userEvent.click(page.getByRole('button', { name: 'Add' }))

    await vi.waitFor(() => expect(written.length).toBe(1))
    expect(written[0]?.contents).toBe(
      '# Ada Lovelace\n\n- Type: #person\n- Email: ada@example.com\n- Phone: +1 555 0100\n',
    )
    await expectLocatorToHaveCount(page.getByText('Ada Lovelace'), 0)
  })

  it('Ignore records the contact in ignoredContacts, then hides the card', async () => {
    await renderCard()
    await userEvent.click(page.getByRole('button', { name: 'Ignore' }))

    await vi.waitFor(() => expect(written.length).toBe(1))
    expect(written[0]?.contents).toBe(
      '---\nignoredContacts:\n  - Ada Lovelace\n---\n\n# Ada Lovelace\n',
    )
    await expectLocatorToHaveCount(page.getByText('Ada Lovelace'), 0)
  })

  it('renders nothing when the body already carries contact details — no lookup', async () => {
    noteSource = '# Ada Lovelace\n\n- Email: ada@example.com\n'
    await renderCard()
    await vi.waitFor(() => expect(contacts.lookups()).toEqual([]))
    expect(page.getByText('Ada Lovelace').query()).toBeNull()
  })

  it('renders nothing for a contact dismissed on this note', async () => {
    noteSource = '---\nignoredContacts:\n  - ada lovelace\n---\n# Ada Lovelace\n'
    await renderCard()
    // The dismissal check needs the match's name, so the lookup does run.
    await vi.waitFor(() =>
      expect(contacts.lookups()).toEqual([{ kind: 'name', name: 'Ada Lovelace' }]),
    )
    expect(page.getByText('ada@example.com · +1 555 0100').query()).toBeNull()
  })

  it('renders nothing when the integration is off', async () => {
    contactsEnabled.current = false
    await renderCard()
    await vi.waitFor(() => expect(contacts.lookups()).toEqual([]))
    expect(page.getByText('Ada Lovelace').query()).toBeNull()
  })

  it('renders nothing while contacts access is denied', async () => {
    contacts.setStatus('denied')
    await renderCard()
    await vi.waitFor(() => expect(contacts.lookups()).toEqual([]))
    expect(page.getByText('Ada Lovelace').query()).toBeNull()
  })
})
