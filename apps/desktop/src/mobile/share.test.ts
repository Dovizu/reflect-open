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
  it('shares the live editor buffer body (frontmatter stripped, title as subject)', async () => {
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

  it('shares the empty body when a ready note was cleared (not stale content)', async () => {
    documents.open({ liveContent: () => '' }, 'notes/meeting-notes.md')
    const { shareNote } = await import('./share.ts')

    await shareNote('notes/meeting-notes.md')

    expect(shareMock).toHaveBeenCalledWith({ title: 'meeting-notes', text: '' })
  })

  it('shares empty rather than reading disk while the session is still loading', async () => {
    // liveContent() is null until load() lands; reading disk here would
    // require an await and break navigator.share's transient activation.
    documents.open({ liveContent: () => null }, 'notes/meeting-notes.md')
    const { shareNote } = await import('./share.ts')

    await shareNote('notes/meeting-notes.md')

    expect(shareMock).toHaveBeenCalledWith({ title: 'meeting-notes', text: '' })
  })
})
