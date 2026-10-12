import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultContacts, setDefaultOpener, setDefaultPlatform } from '@reflect/core'
import {
  createTestContactsService,
  createTestIpcBridgeService,
  createTestOpenerService,
  createTestPlatformService,
  installTestBridge,
  type TestContactsService,
  type TestOpenerService,
} from '@reflect/core/testing'
import { IntegrationsSection } from './integrations-section.tsx'

let opener: TestOpenerService

vi.mock('./calendar-integration-field', () => ({
  CalendarIntegrationField: () => <div>Calendar events</div>,
}))

const settings = vi.hoisted(() => ({
  current: { contactsEnabled: false },
  update: vi.fn((patch: Record<string, unknown>) => {
    settings.current = { ...settings.current, ...patch } as typeof settings.current
  }),
}))
vi.mock('@/providers/settings-provider.tsx', () => ({
  useSettings: () => ({ settings: settings.current, updateSettings: settings.update }),
}))

let contacts: TestContactsService
let removeBridge: () => void

async function renderSection(): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <QueryClientProvider client={queryClient}>
      <IntegrationsSection />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  setDefaultPlatform(createTestPlatformService({ isMacosDesktop: false }))
  contacts = createTestContactsService({ status: 'notDetermined' })
  setDefaultContacts(contacts)
  removeBridge = installTestBridge(createTestIpcBridgeService())
  settings.current = { contactsEnabled: false }
  settings.update.mockClear()
  opener = createTestOpenerService()
  setDefaultOpener(opener)
})

afterEach(() => {
  removeBridge()
  setDefaultContacts(null)
  setDefaultPlatform(null)
})

describe('IntegrationsSection', () => {
  it('enabling persists the opt-in and triggers the permission prompt', async () => {
    await renderSection()
    await page.getByRole('switch', { name: 'Contacts' }).click()

    expect(settings.update).toHaveBeenCalledWith({ contactsEnabled: true })
    await vi.waitFor(() => expect(contacts.accessRequests()).toBe(1))
  })

  it('disabling persists without touching the permission', async () => {
    contacts.setStatus('authorized')
    settings.current = { contactsEnabled: true }
    await renderSection()
    await page.getByRole('switch', { name: 'Contacts' }).click()

    expect(settings.update).toHaveBeenCalledWith({ contactsEnabled: false })
    expect(contacts.accessRequests()).toBe(0)
  })

  it('offers the prompt again when enabled but never asked (e.g. after a restart)', async () => {
    settings.current = { contactsEnabled: true }
    await renderSection()

    await page.getByRole('button', { name: 'Allow contacts access' }).click()
    await vi.waitFor(() => expect(contacts.accessRequests()).toBe(1))
  })

  it('points a denied permission at System Settings', async () => {
    contacts.setStatus('denied')
    settings.current = { contactsEnabled: true }
    await renderSection()

    await page.getByRole('button', { name: 'Open System Settings' }).click()
    await vi.waitFor(() =>
      expect(opener.openedUrls()).toEqual([
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
      ]),
    )
  })

  it('renders nothing where the Contacts framework does not exist', async () => {
    contacts.setStatus('unavailable')
    await renderSection()
    await vi.waitFor(() => expect(page.getByRole('switch').query()).toBeNull())
    expect(page.getByText('Integrations').query()).toBeNull()
  })
})

describe('IntegrationsSection on macOS', () => {
  it('keeps calendar visible on macOS when contacts are unavailable', async () => {
    setDefaultPlatform(createTestPlatformService())
    contacts.setStatus('unavailable')
    await renderSection()

    await expect.element(page.getByText('Calendar events')).toBeInTheDocument()
    expect(page.getByRole('switch', { name: 'Contacts' }).query()).toBeNull()
  })
})
