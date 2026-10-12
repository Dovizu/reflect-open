import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installTestOpenDocuments } from '@/test-utils/open-documents.ts'

const shareMock = vi.fn<(data: ShareData) => Promise<void>>()

const documents = installTestOpenDocuments()

beforeEach(() => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: shareMock })
  shareMock.mockReset()
  shareMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('shareNote', () => {
  // What a note shares is covered with `ShareService` in `@reflect/core`.
  it('hands the live editor buffer body to the OS share sheet', async () => {
    documents.open(
      { liveContent: () => '---\nid: abc123\n---\n# Meeting\n\nAgenda + the unsaved line.\n' },
      'notes/meeting-notes.md',
    )
    const { shareNote } = await import('./share.ts')

    await shareNote('notes/meeting-notes.md')

    expect(shareMock).toHaveBeenCalledWith({
      title: 'meeting-notes',
      text: '# Meeting\n\nAgenda + the unsaved line.\n',
    })
  })
})
