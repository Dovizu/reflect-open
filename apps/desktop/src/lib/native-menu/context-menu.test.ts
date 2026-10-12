import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultPlatform } from '@reflect/core'
import { createTestPlatformService } from '@reflect/core/testing'

const popup = vi.hoisted(() => vi.fn(async () => {}))
interface NativeMenuItemForTest {
  text: string
  action?: () => void
}

interface NativeMenuOptionsForTest {
  items?: NativeMenuItemForTest[]
}

interface NativeMenuForTest {
  popup: () => Promise<void>
}

const menuNew = vi.hoisted(() =>
  vi.fn(async (_options?: NativeMenuOptionsForTest): Promise<NativeMenuForTest> => ({
    popup,
  })),
)

const menuItemNew = vi.hoisted(() => vi.fn(async (options: NativeMenuItemForTest) => options))

vi.mock('@tauri-apps/api/menu', () => ({ Menu: { new: menuNew }, MenuItem: { new: menuItemNew } }))

const { openNativeContextMenu } = await import('./context-menu.ts')

beforeEach(() => {
  setDefaultPlatform(createTestPlatformService())
  popup.mockClear()
  menuItemNew.mockClear()
  menuNew.mockResolvedValue({ popup })
})

afterEach(() => {
  setDefaultPlatform(null)
})

function firstMenuItem(): NativeMenuItemForTest {
  const item = menuNew.mock.calls[0]?.[0]?.items?.[0]
  if (item === undefined) {
    throw new Error('expected native menu item')
  }
  return item
}

describe('openNativeContextMenu', () => {
  it('does nothing outside Tauri', async () => {
    setDefaultPlatform(createTestPlatformService({ isNativeShell: false }))
    const onSelect = vi.fn()

    await openNativeContextMenu({ items: [{ text: 'Unpin Note', action: onSelect }] })

    expect(menuNew).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('opens a native menu whose items run their actions', async () => {
    const onSelect = vi.fn()

    await openNativeContextMenu({ items: [{ text: 'Unpin Note', action: onSelect }] })

    expect(menuNew).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({
          text: 'Unpin Note',
        }),
      ],
    })
    expect(menuItemNew).toHaveBeenCalledWith({ text: 'Unpin Note', action: onSelect })
    expect(popup).toHaveBeenCalled()
    const item = firstMenuItem()
    item.action?.()
    expect(onSelect).toHaveBeenCalled()
  })
})
