import type { ReactElement, ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { describe, expect, it, vi } from 'vitest'
import {
  createTestAppServices,
  createTestNoteFileService,
  createTestOperationsService,
  createTestTemplateService,
} from '@reflect/core/testing'
import { AppServicesProvider } from '@/services/services-provider.tsx'
import type { NoteEditorHandle } from './note-editor.tsx'
import { useTemplateSlashItems } from './use-template-slash-items.ts'

const graphState = vi.hoisted(() => ({
  graph: { root: '/g', generation: 1 } as { root: string; generation: number } | null,
}))
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({ graph: graphState.graph }),
}))

function setup() {
  const operations = createTestOperationsService()
  const templates = createTestTemplateService({
    noteFile: createTestNoteFileService({
      files: {
        'templates/journal.md': '# Journal\n\nMood:\n',
        'templates/person.md': '# Person\n\n- Company:\n',
      },
    }),
    indexQuery: {
      listTemplates: async () => [
        { path: 'templates/journal.md', title: 'Journal', mtime: 1 },
        { path: 'templates/person.md', title: 'Person', mtime: 2 },
      ],
    },
    operations,
  })
  const app = createTestAppServices({ templates, operations })
  function wrapper({ children }: { children: ReactNode }): ReactElement {
    return <AppServicesProvider services={app}>{children}</AppServicesProvider>
  }
  return { wrapper, operations }
}

function fakeEditor(): NoteEditorHandle & { inserted: string[] } {
  const inserted: string[] = []
  return {
    inserted,
    getMarkdown: () => '',
    setMarkdown: () => {},
    insertMarkdown: (markdown) => {
      inserted.push(markdown)
    },
    focus: () => {},
    setSelection: () => {},
    getSelectedText: () => '',
    openSelectionMenu: () => {},
    startPendingReplacement: () => false,
    appendPendingReplacementText: () => {},
    acceptPendingReplacement: () => {},
    discardPendingReplacement: () => {},
    findNext: () => {},
    findPrevious: () => {},
  }
}

describe('useTemplateSlashItems', () => {
  it('maps templates to slash rows whose select inserts through the shared flow', async () => {
    const { wrapper } = setup()
    const editor = fakeEditor()
    const { result } = await renderHook(() => useTemplateSlashItems(() => editor), {
      wrapper,
    })

    const items = await result.current('jour')
    expect(
      items.map((item) => ({
        id: item.id,
        label: item.label,
        keywords: item.keywords,
      })),
    ).toEqual([
      // The shared "template" keyword is the v1 `/template` affordance.
      { id: 'templates/journal.md', label: 'Journal', keywords: ['template'] },
      { id: 'templates/person.md', label: 'Person', keywords: ['template'] },
    ])

    items[0]!.onSelect()
    await vi.waitFor(() => expect(editor.inserted).toEqual(['# Journal\n\nMood:\n']))
  })

  it('resolves the editor at select time, not capture time', async () => {
    // The pane unmounted between the menu opening and the select — the shared
    // flow receives null and surfaces the failure, never a stale editor.
    const { wrapper, operations } = setup()
    const { result } = await renderHook(() => useTemplateSlashItems(() => null), {
      wrapper,
    })
    const items = await result.current('')
    items[0]!.onSelect()
    await vi.waitFor(() =>
      expect(operations.snapshot()).toMatchObject([
        { label: 'Inserting template', status: 'failed', message: 'No open note to insert into' },
      ]),
    )
  })

  it('returns nothing without an open graph', async () => {
    const { wrapper } = setup()
    graphState.graph = null
    try {
      const { result } = await renderHook(() => useTemplateSlashItems(() => fakeEditor()), {
        wrapper,
      })
      await expect(result.current('')).resolves.toEqual([])
    } finally {
      graphState.graph = { root: '/g', generation: 1 }
    }
  })
})
