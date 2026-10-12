import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  setDefaultContacts,
  setDefaultOpener,
  setDefaultPlatform,
  setDefaultSettings,
  type Settings,
} from '@reflect/core'
import {
  createTestContactsService,
  createTestIpcBridgeService,
  createTestOpenerService,
  createTestPlatformService,
  createTestSettingsService,
  installTestBridge,
  type TestContactsService,
  type TestOpenerService,
  type TestSettingsService,
} from '@reflect/core/testing'
import { SettingsProvider } from '@/providers/settings-provider.tsx'
import { IntegrationsSection } from './integrations-section.tsx'

let opener: TestOpenerService

vi.mock('./calendar-integration-field', () => ({
  CalendarIntegrationField: () => <div>Calendar events</div>,
}))

let settings: TestSettingsService
let contacts: TestContactsService
let removeBridge: () => void

/** Render the section over a settings document that starts as `stored`. */
async function renderSection(stored: Partial<Settings> = {}): Promise<void> {
  settings = createTestSettingsService(stored)
  setDefaultSettings(settings)
  await settings.whenLoaded()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <IntegrationsSection />
      </SettingsProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  setDefaultPlatform(createTestPlatformService({ isMacosDesktop: false }))
  contacts = createTestContactsService({ status: 'notDetermined' })
  setDefaultContacts(contacts)
  removeBridge = installTestBridge(createTestIpcBridgeService())
  opener = createTestOpenerService()
  setDefaultOpener(opener)
})

afterEach(() => {
  removeBridge()
  setDefaultContacts(null)
  setDefaultPlatform(null)
  setDefaultSettings(null)
})

describe('IntegrationsSection', () => {
  it('enabling persists the opt-in and triggers the permission prompt', async () => {
    await renderSection()
    await page.getByRole('switch', { name: 'Contacts' }).click()

    await vi.waitFor(() => expect(contacts.accessRequests()).toBe(1))
    expect(settings.get().contactsEnabled).toBe(true)
  })

  it('disabling persists without touching the permission', async () => {
    contacts.setStatus('authorized')
    await renderSection({ contactsEnabled: true })
    await page.getByRole('switch', { name: 'Contacts' }).click()

    await vi.waitFor(() => expect(settings.get().contactsEnabled).toBe(false))
    expect(contacts.accessRequests()).toBe(0)
  })

  it('offers the prompt again when enabled but never asked (e.g. after a restart)', async () => {
    await renderSection({ contactsEnabled: true })

    await page.getByRole('button', { name: 'Allow contacts access' }).click()
    await vi.waitFor(() => expect(contacts.accessRequests()).toBe(1))
  })

  it('points a denied permission at System Settings', async () => {
    contacts.setStatus('denied')
    await renderSection({ contactsEnabled: true })

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
