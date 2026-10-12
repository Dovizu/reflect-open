import { render } from 'vitest-browser-react'
import { page, type Locator } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  setBridge,
  setDefaultCalendar,
  setDefaultOpener,
  setDefaultPlatform,
  setDefaultSettings,
} from '@reflect/core'
import {
  createTestCalendarService,
  createTestOpenerService,
  createTestPlatformService,
  type TestCalendarService,
  type TestOpenerService,
} from '@reflect/core/testing'
import { SettingsProvider } from '@/providers/settings-provider.tsx'
import { CalendarIntegrationField } from './calendar-integration-field.tsx'

// The section renders only in the macOS desktop webview; jsdom is neither.
beforeEach(() => {
  setDefaultPlatform(createTestPlatformService())
})

afterEach(() => {
  setDefaultPlatform(null)
})

let opener: TestOpenerService

const CALENDARS = [
  { id: 'cal-work', title: 'Work', source: 'Google', color: '#ff0000' },
  { id: 'cal-home', title: 'Home', source: 'iCloud', color: null },
]

let stored: Record<string, unknown>
let saved: Array<Record<string, unknown>>
let calendar: TestCalendarService

function installFakeBridge(): void {
  setBridge({
    invoke: async (command, args) => {
      switch (command) {
        case 'settings_load':
          return stored
        case 'settings_save':
          saved.push(args['settings'] as Record<string, unknown>)
          return null
        default:
          return null
      }
    },
    listen: async () => () => {},
  })
}

let queryClient: QueryClient

async function renderSection(): Promise<void> {
  await render(
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <CalendarIntegrationField />
      </SettingsProvider>
    </QueryClientProvider>,
  )
}

function calendarSwitch(): Locator {
  return page.getByRole('switch', { name: /calendar events/i })
}

beforeEach(() => {
  stored = {}
  saved = []
  calendar = createTestCalendarService({ status: 'notDetermined', calendars: CALENDARS })
  setDefaultCalendar(calendar)
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  opener = createTestOpenerService()
  setDefaultOpener(opener)
  installFakeBridge()
  setDefaultSettings(null)
})

afterEach(() => {
  setBridge(null)
  setDefaultSettings(null)
  setDefaultCalendar(null)
  queryClient.clear()
})

describe('CalendarIntegrationField', () => {
  it('starts switched off with no calendar detail', async () => {
    await renderSection()
    await expect.element(calendarSwitch()).toHaveAttribute('aria-checked', 'false')
    expect(page.getByText(/calendars/i).query()).toBeNull()
  })

  it('enabling requests access, persists the setting, and opens the calendar chooser dialog', async () => {
    await renderSection()
    await expect.element(calendarSwitch()).toHaveAttribute('aria-checked', 'false')

    await calendarSwitch().click()

    await vi.waitFor(() =>
      expect(saved.at(-1)).toMatchObject({ calendarEnabled: true, calendarIds: [] }),
    )
    await expect.element(page.getByText('0/2 calendars selected')).toBeInTheDocument()
    expect(page.getByText('Google').query()).toBeNull()
    expect(page.getByText('iCloud').query()).toBeNull()

    await page.getByRole('button', { name: /choose calendars/i }).click()

    await expect.element(page.getByRole('dialog', { name: 'Choose calendars' })).toBeInTheDocument()
    await expect.element(page.getByText('Google')).toBeInTheDocument()
    await expect.element(page.getByText('iCloud')).toBeInTheDocument()
    await expect.element(page.getByRole('checkbox', { name: 'Work' })).toBeInTheDocument()
    await expect.element(page.getByRole('checkbox', { name: 'Home' })).toBeInTheDocument()
  })

  it('shows nothing (not "No calendars found") while the list is still loading', async () => {
    stored = { calendarEnabled: true }
    calendar.setStatus('fullAccess')
    setDefaultCalendar({ ...calendar, listCalendars: () => new Promise(() => {}) })
    await renderSection()

    await expect.element(calendarSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(page.getByText(/no calendars found/i).query()).toBeNull()
  })

  it('shows the empty state once an empty list has actually loaded', async () => {
    stored = { calendarEnabled: true }
    calendar.setStatus('fullAccess')
    calendar.setCalendars([])
    await renderSection()

    await expect.element(page.getByText(/no calendars found/i)).toBeInTheDocument()
  })

  it('toggling a calendar persists its id and updates the count', async () => {
    stored = { calendarEnabled: true }
    calendar.setStatus('fullAccess')
    await renderSection()
    await expect.element(page.getByText('0/2 calendars selected')).toBeInTheDocument()
    await page.getByRole('button', { name: /choose calendars/i }).click()

    await page.getByRole('checkbox', { name: 'Work' }).click()

    await vi.waitFor(() => expect(saved.at(-1)).toMatchObject({ calendarIds: ['cal-work'] }))
    await expect.element(page.getByText('1/2 calendars selected')).toBeInTheDocument()
  })

  it('counts only ids the Mac still knows, ignoring stale ones', async () => {
    stored = { calendarEnabled: true, calendarIds: ['cal-work', 'cal-gone-1', 'cal-gone-2'] }
    calendar.setStatus('fullAccess')
    await renderSection()

    await expect.element(page.getByText('1/2 calendars selected')).toBeInTheDocument()
  })

  it('denied access shows the explanation and deep-links to System Settings', async () => {
    stored = { calendarEnabled: true }
    calendar.setStatus('denied')
    await renderSection()

    const open = page.getByRole('button', { name: /open system settings/i })
    await expect.element(page.getByText(/can’t read your calendars/i)).toBeInTheDocument()

    await open.click()
    await vi.waitFor(() =>
      expect(opener.openedUrls()).toEqual([
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars',
      ]),
    )
  })

  it('not-yet-asked access shows a Grant button that prompts and recovers', async () => {
    stored = { calendarEnabled: true }
    calendar.setStatus('notDetermined')
    await renderSection()

    await page.getByRole('button', { name: /grant access/i }).click()

    await vi.waitFor(() => expect(calendar.accessRequests()).toBe(1))
    // The grant resolved and the invalidated auth query re-ran: the calendar
    // list replaces the permission explanation.
    await expect.element(page.getByText('0/2 calendars selected')).toBeInTheDocument()
  })
})
