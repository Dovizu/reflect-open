import { afterEach, describe, expect, it } from 'vitest'
import { createTestDialogService } from '../testing/shell.ts'
import { defaultDialog, setDefaultDialog } from './dialog-service.ts'

afterEach(() => {
  setDefaultDialog(null)
})

describe('defaultDialog', () => {
  it('throws until a host installs one', () => {
    expect(() => defaultDialog()).toThrow(/No DialogService is installed/)
    const dialog = createTestDialogService()
    setDefaultDialog(dialog)
    expect(defaultDialog()).toBe(dialog)
  })
})
