import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setDefaultPlatform } from '@reflect/core'
import { createTestPlatformService } from '@reflect/core/testing'
import '@/test-utils/locator.ts'
import { ShortcutsDialog } from './shortcuts-dialog.tsx'
import { ShortcutsProvider, useShortcuts } from '@/providers/shortcuts-provider.tsx'

beforeEach(() => {
  setDefaultPlatform(createTestPlatformService({ isApplePlatform: false }))
})

afterEach(() => {
  setDefaultPlatform(null)
})

function OpenButton() {
  const { openShortcuts } = useShortcuts()
  return (
    <button type="button" onClick={openShortcuts}>
      open
    </button>
  )
}

function renderDialog() {
  return render(
    <ShortcutsProvider>
      <OpenButton />
      <ShortcutsDialog />
    </ShortcutsProvider>,
  )
}

async function openDialog(): Promise<HTMLElement | SVGElement> {
  await userEvent.click(page.getByRole('button', { name: 'open' }))
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect.element(dialog).toBeInTheDocument()
  return dialog.element()
}

describe('ShortcutsDialog', () => {
  it('renders nothing until opened', async () => {
    await renderDialog()
    expect(page.getByRole('dialog').query()).toBeNull()
  })

  it('lists both keymap scopes from the registries', async () => {
    await renderDialog()
    await openDialog()
    // One row from each scope — derived data, so any registered binding works.
    await expect.element(page.getByText('Go to today')).toBeInTheDocument()
    await expect.element(page.getByText('Bold')).toBeInTheDocument()
    // The cheat-sheet lists itself; a user who forgot ⌘/ can re-learn it here.
    await expect
      .element(page.locate('li').filter({ hasText: 'Keyboard shortcuts' }))
      .toBeInTheDocument()
  })

  it('lists the AI menu shortcut with the Apple command chord', async () => {
    setDefaultPlatform(createTestPlatformService({ isApplePlatform: true }))
    await renderDialog()
    await openDialog()

    const row = page.getByText('Open the AI menu on the selection').element().closest('li')

    if (row === null) {
      throw new Error('AI menu shortcut row was not rendered')
    }
    expect([...row.querySelectorAll('kbd')].map((keycap) => keycap.textContent)).toEqual([
      '⌘',
      '⇧',
      'J',
    ])
  })

  it('keeps the sheet within the viewport and scrolls the shortcut rows', async () => {
    await renderDialog()
    const dialog = await openDialog()
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(dialog.className).toContain('overflow-hidden')
    expect(dialog.querySelector('.overflow-y-auto')).toBeTruthy()
  })

  it('uses extra desktop width for additional shortcut columns', async () => {
    await renderDialog()
    const dialog = await openDialog()
    expect(dialog.className).toContain('lg:max-w-5xl')
    expect(dialog.className).toContain('xl:max-w-6xl')
    const editorList = page
      .getByRole('heading', { name: 'Editor' })
      .element()
      .parentElement?.querySelector('ul')
    expect(editorList?.className).toContain('lg:columns-2')
    expect(editorList?.className).toContain('xl:columns-3')
  })

  it('closes on Escape', async () => {
    await renderDialog()
    await openDialog()
    await userEvent.keyboard('{Escape}')
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
  })
})
