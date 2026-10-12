import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultContacts, setDefaultSettings } from '@reflect/core'
import {
  createTestContactsService,
  createTestIpcBridgeService,
  createTestSettingsService,
  installTestBridge,
  type TestContactsService,
} from '@reflect/core/testing'
import { SettingsProvider } from '@/providers/settings-provider.tsx'
import { expectLocatorToHaveCount } from '@/test-utils/expect.ts'
import { installTestNoteFile } from '@/test-utils/note-file.ts'
import { SuggestedContactCard } from './suggested-contact-card.tsx'

// The card reads the write generation from the graph provider, which is
// per-app plumbing the component test doesn't need.
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({ graph: { root: '/g', generation: 3 } }),
}))

const PATH = 'notes/Ada Lovelace.md'

const ADA = {
  fullName: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  emails: ['ada@example.com'],
  phones: ['+1 555 0100'],
}

const noteFile = installTestNoteFile()
let contacts: TestContactsService
let removeBridge: () => void

/** Render the card with the contacts integration switched on or off. */
async function renderCard(contactsEnabled = true): Promise<void> {
  const settings = createTestSettingsService({ contactsEnabled })
  setDefaultSettings(settings)
  await settings.whenLoaded()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <SuggestedContactCard path={PATH} />
      </SettingsProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  noteFile.service().set(PATH, '# Ada Lovelace\n')
  contacts = createTestContactsService({ contacts: [ADA] })
  setDefaultContacts(contacts)
  removeBridge = installTestBridge(createTestIpcBridgeService())
})

afterEach(() => {
  removeBridge()
  setDefaultContacts(null)
  setDefaultSettings(null)
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

    await vi.waitFor(() => expect(noteFile.service().writes()).toHaveLength(1))
    expect(noteFile.service().getWrites(PATH)).toEqual([
      '# Ada Lovelace\n\n- Type: #person\n- Email: ada@example.com\n- Phone: +1 555 0100\n',
    ])
    await expectLocatorToHaveCount(page.getByText('Ada Lovelace'), 0)
  })

  it('Ignore records the contact in ignoredContacts, then hides the card', async () => {
    await renderCard()
    await userEvent.click(page.getByRole('button', { name: 'Ignore' }))

    await vi.waitFor(() => expect(noteFile.service().writes()).toHaveLength(1))
    expect(noteFile.service().getWrites(PATH)).toEqual([
      '---\nignoredContacts:\n  - Ada Lovelace\n---\n\n# Ada Lovelace\n',
    ])
    await expectLocatorToHaveCount(page.getByText('Ada Lovelace'), 0)
  })

  it('renders nothing when the body already carries contact details — no lookup', async () => {
    noteFile.service().set(PATH, '# Ada Lovelace\n\n- Email: ada@example.com\n')
    await renderCard()
    await vi.waitFor(() => expect(contacts.lookups()).toEqual([]))
    expect(page.getByText('Ada Lovelace').query()).toBeNull()
  })

  it('renders nothing for a contact dismissed on this note', async () => {
    noteFile.service().set(PATH, '---\nignoredContacts:\n  - ada lovelace\n---\n# Ada Lovelace\n')
    await renderCard()
    // The dismissal check needs the match's name, so the lookup does run.
    await vi.waitFor(() =>
      expect(contacts.lookups()).toEqual([{ kind: 'name', name: 'Ada Lovelace' }]),
    )
    expect(page.getByText('ada@example.com · +1 555 0100').query()).toBeNull()
  })

  it('renders nothing when the integration is off', async () => {
    await renderCard(false)
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
