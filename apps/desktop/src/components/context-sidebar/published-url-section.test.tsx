import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  setDefaultClipboard,
  setDefaultOpener,
  setDefaultStorage,
  type NoteRow,
} from '@reflect/core'
import {
  createTestClipboardService,
  createTestOpenerService,
  createTestStorageService,
  type TestClipboardService,
  type TestOpenerService,
} from '@reflect/core/testing'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { PublishedUrlSection } from './published-url-section.tsx'

const useNoteRow = vi.hoisted(() => vi.fn<(path: string) => NoteRow | null>(() => null))
const operationDone = vi.hoisted(() => vi.fn())
const operationFail = vi.hoisted(() => vi.fn())
const startOperation = vi.hoisted(() =>
  vi.fn(() => ({ progress: vi.fn(), done: operationDone, fail: operationFail })),
)
const runGistPublish = vi.hoisted(() =>
  vi.fn<(path: string, generation: number) => Promise<string | null>>(
    async () => 'https://gist.github.com/alex/g1',
  ),
)

vi.mock('@/hooks/use-note-row.ts', () => ({ useNoteRow }))
vi.mock('@/lib/note-gist.ts', () => ({ runGistPublish }))
vi.mock('@/lib/operations.ts', () => ({ startOperation }))
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({ graph: { root: '/g', name: 'g', generation: 7 } }),
}))

function noteRow(overrides: Partial<NoteRow> = {}): NoteRow {
  return {
    path: 'notes/a.md',
    title: 'A',
    dailyDate: null,
    isPrivate: false,
    hasConflict: false,
    gistUrl: null,
    gistStale: false,
    ...overrides,
  }
}

function renderSection(path = 'notes/a.md') {
  return render(
    <TooltipProvider>
      <PublishedUrlSection path={path} />
    </TooltipProvider>,
  )
}

let clipboard: TestClipboardService
let opener: TestOpenerService

beforeEach(() => {
  setDefaultStorage(createTestStorageService())
  useNoteRow.mockReset().mockReturnValue(null)
  clipboard = createTestClipboardService()
  setDefaultClipboard(clipboard)
  opener = createTestOpenerService()
  setDefaultOpener(opener)
  startOperation.mockClear()
  runGistPublish.mockReset().mockResolvedValue('https://gist.github.com/alex/g1')
  operationDone.mockClear()
  operationFail.mockClear()
})

afterEach(() => {
  setDefaultStorage(null)
})

describe('PublishedUrlSection', () => {
  it('renders nothing for an unpublished note', async () => {
    const view = await renderSection()
    expect(view.getByText('Published URL').query()).toBeNull()
  })

  it('shows the published gist URL for a published note', async () => {
    const url = 'https://gist.github.com/alex/g1'
    useNoteRow.mockReturnValue(noteRow({ gistUrl: url }))

    const view = await renderSection()
    await expect.element(view.getByText('Published URL')).toBeInTheDocument()
    await expect.element(view.getByRole('link', { name: url })).toHaveAttribute('href', url)
  })

  it('opens the published URL through the native opener', async () => {
    const url = 'https://gist.github.com/alex/g1'
    useNoteRow.mockReturnValue(noteRow({ gistUrl: url }))

    const view = await renderSection()
    await userEvent.click(view.getByRole('link', { name: url }))
    await vi.waitFor(() => expect(opener.openedUrls()).toEqual([url]))
  })

  it('copies the published URL', async () => {
    const url = 'https://gist.github.com/alex/g1'
    useNoteRow.mockReturnValue(noteRow({ gistUrl: url }))

    const view = await renderSection()
    await userEvent.click(view.getByRole('button', { name: 'Copy published URL' }))

    await vi.waitFor(() => expect(clipboard.writes()).toEqual([url]))
    await vi.waitFor(() => expect(startOperation).toHaveBeenCalledWith('Published URL copied'))
    expect(operationDone).toHaveBeenCalled()
  })

  it('updates the published gist from the URL section icon', async () => {
    const url = 'https://gist.github.com/alex/g1'
    useNoteRow.mockReturnValue(noteRow({ gistUrl: url }))

    const view = await renderSection()
    await userEvent.click(view.getByRole('button', { name: 'Update published gist' }))

    expect(runGistPublish).toHaveBeenCalledWith('notes/a.md', 7)
  })

  it('shows the stale update affordance beside the copy button', async () => {
    const url = 'https://gist.github.com/alex/g1'
    useNoteRow.mockReturnValue(noteRow({ gistUrl: url, gistStale: true }))

    const view = await renderSection()
    await expect
      .element(view.getByRole('button', { name: 'Copy published URL' }))
      .toBeInTheDocument()
    await expect
      .element(view.getByRole('button', { name: 'Update published gist' }))
      .toBeInTheDocument()
    expect(
      view.getByRole('button', { name: 'Update published gist' }).element().className,
    ).toContain('text-accent')
  })

  it('surfaces copy failures through the operations status', async () => {
    const url = 'https://gist.github.com/alex/g1'
    clipboard.failWith(new Error('Document is not focused'))
    useNoteRow.mockReturnValue(noteRow({ gistUrl: url }))

    const view = await renderSection()
    await userEvent.click(view.getByRole('button', { name: 'Copy published URL' }))

    await vi.waitFor(() => expect(startOperation).toHaveBeenCalledWith('Copying the published URL'))
    expect(operationFail).toHaveBeenCalled()
  })
})
