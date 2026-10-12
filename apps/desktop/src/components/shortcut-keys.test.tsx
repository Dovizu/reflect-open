import { render } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setDefaultPlatform } from '@reflect/core'
import { createTestPlatformService } from '@reflect/core/testing'
import { ShortcutKeys } from './shortcut-keys.tsx'

function keycapLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('kbd')].map((keycap) => keycap.textContent ?? '')
}

beforeEach(() => {
  setDefaultPlatform(createTestPlatformService({ isApplePlatform: false }))
})

afterEach(() => {
  setDefaultPlatform(null)
})

describe('ShortcutKeys', () => {
  it('renders Mod-k as command keycaps on Apple platforms', async () => {
    setDefaultPlatform(createTestPlatformService({ isApplePlatform: true }))
    const view = await render(<ShortcutKeys binding="Mod-k" />)
    expect(keycapLabels(view.container)).toEqual(['⌘', 'K'])
    await view.unmount()
  })

  it('renders Mod-k as Ctrl keycaps elsewhere', async () => {
    const view = await render(<ShortcutKeys binding="Mod-k" />)
    expect(keycapLabels(view.container)).toEqual(['Ctrl', 'K'])
    await view.unmount()
  })

  it('renders one keycap per modifier with named-key symbols', async () => {
    setDefaultPlatform(createTestPlatformService({ isApplePlatform: true }))
    const view = await render(<ShortcutKeys binding="Mod-Shift-Enter" />)
    expect(keycapLabels(view.container)).toEqual(['⌘', '⇧', '↩'])
    await view.unmount()
  })

  it('groups all keys inside a single pill, V1-style', async () => {
    setDefaultPlatform(createTestPlatformService({ isApplePlatform: true }))
    const view = await render(<ShortcutKeys binding="Mod-Shift-Enter" />)
    const pills = view.container.querySelectorAll(':scope > span')
    expect(pills).toHaveLength(1)
    expect(pills[0]?.querySelectorAll('kbd')).toHaveLength(3)
    await view.unmount()
  })

  it('ghost mode renders the keys as plain joined text, not keycaps', async () => {
    setDefaultPlatform(createTestPlatformService({ isApplePlatform: true }))
    const view = await render(<ShortcutKeys binding="Mod-k" ghost />)
    expect(keycapLabels(view.container)).toEqual([])
    expect(view.container.textContent).toBe('⌘K')
    await view.unmount()
  })
})
