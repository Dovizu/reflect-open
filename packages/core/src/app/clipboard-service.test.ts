import { afterEach, describe, expect, it } from 'vitest'
import { createTestClipboardService } from '../testing/shell.ts'
import { defaultClipboard, setDefaultClipboard } from './clipboard-service.ts'

afterEach(() => {
  setDefaultClipboard(null)
})

describe('defaultClipboard', () => {
  it('throws until a host installs one', () => {
    expect(() => defaultClipboard()).toThrow(/No ClipboardService is installed/)
    const clipboard = createTestClipboardService()
    setDefaultClipboard(clipboard)
    expect(defaultClipboard()).toBe(clipboard)
  })
})
