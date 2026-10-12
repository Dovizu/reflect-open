import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBridge, setDefaultDialog } from '@reflect/core'
import { createTestDialogService, type TestDialogService } from '@reflect/core/testing'
import {
  registerNoteEditorHandle,
  unregisterNoteEditorHandle,
} from '@/editor/editor-handle-registry.ts'
import type { NoteEditorHandle } from '@/editor/note-editor.tsx'
import type { CommandContext } from '@/lib/commands/types.ts'
import { attachFilesToNote } from './attach-files.ts'

let dialog: TestDialogService

beforeEach(() => {
  dialog = createTestDialogService()
  setDefaultDialog(dialog)
})

function contextFor(notePath: string | null, generation: number | null): CommandContext {
  return {
    navigate: vi.fn(),
    route: () => ({ kind: 'today' }),
    notePath: () => notePath,
    back: vi.fn(),
    forward: vi.fn(),
    togglePin: vi.fn(async () => {}),
    togglePrivate: vi.fn(async () => {}),
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    newChat: vi.fn(),
    openNoteFind: vi.fn(),
    findNextInNote: vi.fn(),
    findPreviousInNote: vi.fn(),
    switchGraph: vi.fn(),
    toggleAudioMemo: vi.fn(),
    generation: () => generation,
    graphRoot: () => '/g',
    openPalette: vi.fn(),
    openShortcuts: vi.fn(),
    openTemplatePicker: vi.fn(),
    openTemplateCreate: vi.fn(),
    enableSemanticSearch: vi.fn(),
    clearScrollState: vi.fn(),
  }
}

function editorHandle(): NoteEditorHandle & {
  insertMarkdown: ReturnType<typeof vi.fn<(markdown: string) => void>>
} {
  return {
    getMarkdown: () => '',
    setMarkdown: () => {},
    insertMarkdown: vi.fn<(markdown: string) => void>(),
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

afterEach(() => {
  setBridge(null)
})

describe('attachFilesToNote', () => {
  it('imports each pick and inserts one link per line at the caret', async () => {
    const invoke = vi.fn(async (_command: string, args: Record<string, unknown>) =>
      typeof args['desiredName'] === 'string' ? `assets/${args['desiredName'] as string}` : null,
    )
    setBridge({ invoke, listen: async () => () => {} })
    dialog.setFiles(['/Users/me/Q3 Report.pdf', '/Users/me/archive.tar.gz'])
    const handle = editorHandle()
    registerNoteEditorHandle('notes/plan.md', handle)

    await attachFilesToNote(contextFor('notes/plan.md', 4))

    expect(invoke).toHaveBeenCalledWith('asset_import', {
      sourcePath: '/Users/me/Q3 Report.pdf',
      desiredName: 'q3-report.pdf',
      generation: 4,
    })
    expect(handle.insertMarkdown).toHaveBeenCalledWith(
      '[Q3 Report.pdf](assets/q3-report.pdf)\n[archive.tar.gz](assets/archive-tar.gz)',
    )
    unregisterNoteEditorHandle('notes/plan.md', handle)
  })

  it('escapes bracketed filenames in the link label', async () => {
    const invoke = vi.fn(async () => 'assets/report-v2.pdf')
    setBridge({ invoke, listen: async () => () => {} })
    dialog.setFiles(['/tmp/report [v2].pdf'])
    const handle = editorHandle()
    registerNoteEditorHandle('notes/plan.md', handle)

    await attachFilesToNote(contextFor('notes/plan.md', 4))

    expect(handle.insertMarkdown).toHaveBeenCalledWith(
      String.raw`[report \[v2\].pdf](assets/report-v2.pdf)`,
    )
    unregisterNoteEditorHandle('notes/plan.md', handle)
  })

  it('does nothing without a routed note, a mounted editor, or a pick', async () => {
    const invoke = vi.fn(async () => 'assets/x')
    setBridge({ invoke, listen: async () => () => {} })

    await attachFilesToNote(contextFor(null, 4))
    expect(dialog.calls()).toEqual([])

    // Routed note but no mounted editor for it.
    await attachFilesToNote(contextFor('notes/closed.md', 4))
    expect(dialog.calls()).toEqual([])

    // Cancelled picker.
    const handle = editorHandle()
    registerNoteEditorHandle('notes/plan.md', handle)
    dialog.setFiles(null)
    await attachFilesToNote(contextFor('notes/plan.md', 4))
    expect(invoke).not.toHaveBeenCalled()
    expect(handle.insertMarkdown).not.toHaveBeenCalled()
    unregisterNoteEditorHandle('notes/plan.md', handle)
  })

  it('re-resolves the editor after the picker and drops the insert when it unmounted', async () => {
    const invoke = vi.fn(async () => 'assets/report.pdf')
    setBridge({ invoke, listen: async () => () => {} })
    const handle = editorHandle()
    registerNoteEditorHandle('notes/plan.md', handle)
    // The pane unmounts while the (native, unbounded) picker is open.
    setDefaultDialog({
      ...dialog,
      pickFiles: async () => {
        unregisterNoteEditorHandle('notes/plan.md', handle)
        return ['/tmp/report.pdf']
      },
    })

    await attachFilesToNote(contextFor('notes/plan.md', 4))

    // The copy still happened (the file exists in assets/) but nothing is
    // dispatched into the dead editor.
    expect(invoke).toHaveBeenCalledWith('asset_import', expect.anything())
    expect(handle.insertMarkdown).not.toHaveBeenCalled()
  })

  it('continues past a failed copy and still links every file that landed', async () => {
    const invoke = vi.fn(async (_command: string, args: Record<string, unknown>) => {
      if (args['sourcePath'] === '/tmp/bad.bin') {
        throw { kind: 'io', message: 'copy failed' }
      }
      return `assets/${args['desiredName'] as string}`
    })
    setBridge({ invoke, listen: async () => () => {} })
    // The failure comes FIRST: the files picked after it must still import.
    dialog.setFiles(['/tmp/bad.bin', '/tmp/good.pdf', '/tmp/also good.pdf'])
    const handle = editorHandle()
    registerNoteEditorHandle('notes/plan.md', handle)

    await attachFilesToNote(contextFor('notes/plan.md', 4))

    expect(handle.insertMarkdown).toHaveBeenCalledWith(
      '[good.pdf](assets/good.pdf)\n[also good.pdf](assets/also-good.pdf)',
    )
    unregisterNoteEditorHandle('notes/plan.md', handle)
  })
})
