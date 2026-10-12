import { createTestOperationsService } from '@reflect/core/testing'
import { act, createElement, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultOperations } from '@reflect/core'
import { installTestNoteFile } from '@/test-utils/note-file.ts'
import { installTestOpenDocuments } from '@/test-utils/open-documents.ts'
import { useNoteTrash } from './use-note-trash.ts'

interface GraphValue {
  graph: { root: string; name: string; generation: number } | null
}
let graphValue: GraphValue
vi.mock('@/providers/graph-provider.tsx', () => ({ useGraph: () => graphValue }))

installTestOpenDocuments()
const noteFile = installTestNoteFile()

let client: QueryClient
function wrapper({ children }: { children: ReactNode }): ReactNode {
  return createElement(QueryClientProvider, { client }, children)
}

beforeEach(() => {
  setDefaultOperations(createTestOperationsService())
  graphValue = { graph: { root: '/g', name: 'g', generation: 1 } }
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  for (const path of ['notes/a.md', 'notes/b.md', 'notes/c.md']) {
    noteFile.service().set(path, '# Note\n')
  }
})

afterEach(() => {
  setDefaultOperations(null)
})

describe('useNoteTrash', () => {
  it('reports a failure without trashing when no graph is open (never a silent success)', async () => {
    graphValue = { graph: null }
    const { result } = await renderHook(() => useNoteTrash(), { wrapper })

    await expect(result.current.trash(['notes/a.md'])).resolves.toBe(false)
    expect(noteFile.service().trashed()).toEqual([])
  })

  it('is a no-op for an empty selection', async () => {
    const { result } = await renderHook(() => useNoteTrash(), { wrapper })

    await expect(result.current.trash([])).resolves.toBe(true)
    expect(noteFile.service().trashed()).toEqual([])
  })

  it('trashes every note and resolves true', async () => {
    const { result } = await renderHook(() => useNoteTrash(), { wrapper })

    let trashed = false
    await act(async () => {
      trashed = await result.current.trash(['notes/a.md', 'notes/b.md'])
    })

    expect(trashed).toBe(true)
    expect(noteFile.service().trashed()).toEqual(['notes/a.md', 'notes/b.md'])
  })

  it('keeps going past a per-note failure and resolves false', async () => {
    const files = noteFile.service()
    const trashFile = files.delete.bind(files)
    vi.spyOn(files, 'delete').mockImplementation(async (path, generation) => {
      if (path === 'notes/b.md') {
        throw new Error('locked')
      }
      await trashFile(path, generation)
    })
    const { result } = await renderHook(() => useNoteTrash(), { wrapper })

    let trashed = true
    await act(async () => {
      trashed = await result.current.trash(['notes/a.md', 'notes/b.md', 'notes/c.md'])
    })

    // The batch reports failure but still attempted (and trashed) the others.
    expect(trashed).toBe(false)
    expect(files.trashed()).toEqual(['notes/a.md', 'notes/c.md'])
  })
})
