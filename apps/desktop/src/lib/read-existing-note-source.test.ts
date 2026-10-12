import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readNote } from '@reflect/core'
import { installTestOpenDocuments } from '@/test-utils/open-documents.ts'
import { readExistingNoteSource } from './read-existing-note-source.ts'

vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  readNote: vi.fn(),
}))

const readNoteMock = vi.mocked(readNote)
const documents = installTestOpenDocuments()

describe('readExistingNoteSource', () => {
  beforeEach(() => {
    readNoteMock.mockReset()
  })

  it('reads the live buffer of an open, ready session', async () => {
    documents.open({ liveContent: () => '# Live' })
    readNoteMock.mockResolvedValue('# On disk')

    await expect(readExistingNoteSource('notes/a.md', 7)).resolves.toBe('# Live')
    expect(readNoteMock).toHaveBeenCalledWith('notes/a.md', 7)
  })

  it('preserves an authoritative empty live buffer', async () => {
    documents.open({ liveContent: () => '' })
    readNoteMock.mockResolvedValue('# On disk')

    await expect(readExistingNoteSource('notes/a.md', 7)).resolves.toBe('')
    expect(readNoteMock).toHaveBeenCalledWith('notes/a.md', 7)
  })

  it('refuses a stale live buffer when its generation-pinned file is gone', async () => {
    documents.open({ liveContent: () => '# Stale' })
    readNoteMock.mockRejectedValue({ kind: 'notFound', message: 'removed' })

    await expect(readExistingNoteSource('notes/a.md', 7)).rejects.toMatchObject({
      kind: 'notFound',
    })
  })

  it('falls back to a generation-pinned disk read while the session is loading', async () => {
    documents.open({ liveContent: () => null })
    readNoteMock.mockResolvedValue('# On disk')

    await expect(readExistingNoteSource('notes/a.md', 7)).resolves.toBe('# On disk')
    expect(readNoteMock).toHaveBeenCalledWith('notes/a.md', 7)
  })
})
