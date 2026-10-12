import { render } from 'vitest-browser-react'
import { page, type Locator } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultDialog } from '@reflect/core'
import { createTestDialogService, type TestDialogService } from '@reflect/core/testing'
import type { V1ImportState } from '@/lib/v1-import-state.ts'

const startImport = vi.hoisted(() => vi.fn())
const importState = vi.hoisted((): { state: V1ImportState } => ({
  state: { phase: 'idle' },
}))

vi.mock('@/providers/v1-import-provider.tsx', () => ({
  useV1Import: () => ({
    state: importState.state,
    startImport,
    cancelImport: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

const { ImportSection } = await import('./import-section.tsx')

let dialog: TestDialogService

beforeEach(() => {
  dialog = createTestDialogService({ files: ['/Users/alex/Downloads/reflect-v1.zip'] })
  setDefaultDialog(dialog)
  importState.state = { phase: 'idle' }
})

afterEach(() => {
  vi.clearAllMocks()
})

function importButton(): Locator {
  return page.getByRole('button', { name: /import/i })
}

describe('ImportSection', () => {
  it('hands the picked Reflect V1 zip to the import controller', async () => {
    await render(<ImportSection />)

    await importButton().click()

    await vi.waitFor(() =>
      expect(dialog.calls()).toEqual([
        {
          kind: 'files',
          options: {
            multiple: false,
            title: 'Import Reflect V1 export',
            filters: [{ name: 'Zip archives', extensions: ['zip'] }],
          },
        },
      ]),
    )
    await vi.waitFor(() =>
      expect(startImport).toHaveBeenCalledWith('/Users/alex/Downloads/reflect-v1.zip'),
    )
  })

  it('does nothing when the picker is cancelled', async () => {
    dialog.setFiles(null)
    await render(<ImportSection />)

    await importButton().click()

    await vi.waitFor(() => expect(dialog.calls()).toHaveLength(1))
    expect(startImport).not.toHaveBeenCalled()
  })

  it('is disabled while an import runs', async () => {
    importState.state = { phase: 'running', progress: null, cancelling: false }
    await render(<ImportSection />)

    await expect.element(importButton()).toBeDisabled()
    expect(importButton().element().textContent).toContain('Importing')
  })
})
