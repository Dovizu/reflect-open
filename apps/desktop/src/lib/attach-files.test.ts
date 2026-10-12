import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestAppServices, type TestAppServices } from '@reflect/core/testing'
import {
  registerNoteEditorHandle,
  unregisterNoteEditorHandle,
} from '@/editor/editor-handle-registry.ts'
import type { NoteEditorHandle } from '@/editor/note-editor.tsx'
import type { CommandContext } from '@/lib/commands/types.ts'
import { attachFilesToNote } from './attach-files.ts'

let app: TestAppServices

beforeEach(() => {
  app = createTestAppServices()
})

afterEach(() => {
  app.database.close()
})

function contextFor(notePath: string | null, generation: number | null): CommandContext {
  return {
    services: app,
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

function editorHandle(): NoteEditorHandle {
  return {
    getMarkdown: () => '',
    setMarkdown: () => {},
    insertMarkdown: () => {},
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

describe('attachFilesToNote', () => {
  it("attaches into the routed note's editor, looked up on every call", async () => {
    await attachFilesToNote(contextFor('notes/plan.md', 4))

    const [request] = app.attachments.attachRequests()
    expect(request?.generation).toBe(4)
    expect(request?.findEditor()).toBeNull()

    const handle = editorHandle()
    registerNoteEditorHandle('notes/plan.md', handle)
    expect(request?.findEditor()).toBe(handle)
    unregisterNoteEditorHandle('notes/plan.md', handle)
    expect(request?.findEditor()).toBeNull()
  })

  it('does nothing without a routed note or a graph session', async () => {
    await attachFilesToNote(contextFor(null, 4))
    await attachFilesToNote(contextFor('notes/plan.md', null))

    expect(app.attachments.attachRequests()).toEqual([])
  })
})
