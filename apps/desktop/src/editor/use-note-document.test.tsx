import { beforeEach, describe, expect, it, vi } from 'vitest'
import { upsertFrontmatter, type FileChange, type NoteFileService } from '@reflect/core'
import {
  createTestAppServices,
  createTestClockService,
  createTestIndexStoreService,
  createTestLoggerService,
  createTestNoteFileService,
  seedNotes,
  type TestClockService,
  type TestDatabaseService,
  type TestLoggerService,
  type TestNoteFileService,
} from '@reflect/core/testing'
import { renderHookInApp } from '@/test-utils/render-in-app.tsx'
import { createWasmTestDatabaseService } from '@/test-utils/test-database.ts'
import type { NoteEditorHandle } from './note-editor.tsx'
import { useNoteDocument } from './use-note-document.ts'

/**
 * Runs the save debounce and the rename quiet period.
 */
let clock: TestClockService
let logger: TestLoggerService
/**
 * The files of the graph, with a log of every write.
 */
let noteFile: TestNoteFileService
/**
 * What a note write does; a test replaces it to hold or fail a write.
 */
let writeNote: NoteFileService['write']
/**
 * The unspied `write` of `noteFile`, which the app reaches through `writeNote`.
 */
let realWrite: NoteFileService['write']
let app: ReturnType<typeof createApp>

/**
 * Run every pending timer, and the timers those arm.
 */
async function runAllTimers(): Promise<void> {
  await clock.advance(60_000)
}

const MANAGED_ID = '01hv3xq7c2dm8k4t9w5e6r1n98'

function managedNote(content: string): string {
  return upsertFrontmatter(content, { id: MANAGED_ID })
}

function fakeEditor(): NoteEditorHandle & { applied: string[] } {
  const applied: string[] = []
  return {
    applied,
    setMarkdown: (markdown) => {
      applied.push(markdown)
    },
    getMarkdown: () => '',
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

/**
 * The app of one test: the real document services over `noteFile`, `clock` and `logger`.
 */
function createApp(database: TestDatabaseService) {
  const indexStore = createTestIndexStoreService()
  const moveIndexed = indexStore.moveIndexed.bind(indexStore)
  // Mirrors the Rust command for the paths these tests exercise: a free
  // destination renames (occupied ones refuse, but no test stages that).
  vi.spyOn(indexStore, 'moveIndexed').mockImplementation(async (from, to, generation) => {
    const contents = noteFile.files().get(from)
    if (contents !== undefined && !noteFile.files().has(to)) {
      noteFile.set(to, contents)
    }
    await noteFile.delete(from, generation)
    await moveIndexed(from, to, generation)
  })
  return createTestAppServices({
    clock,
    logger,
    database,
    noteFile,
    indexStore,
  })
}

beforeEach(async () => {
  clock = createTestClockService()
  logger = createTestLoggerService()
  noteFile = createTestNoteFileService({ files: { 'notes/a.md': '# Hello\n' } })
  realWrite = noteFile.write.bind(noteFile)
  vi.spyOn(noteFile, 'write').mockImplementation((...args) => writeNote(...args))
  writeNote = (...args) => realWrite(...args)
  // Opened here, so every index read of a rename settles in microtasks.
  app = createApp(await createWasmTestDatabaseService())
})

/**
 * Render `hook` in the app of the running test, whose graph is open on generation 1.
 */
function mount<Result, Props = undefined>(
  hook: (props?: Props) => Result,
  options?: { initialProps: Props },
) {
  return renderHookInApp(hook, { app, ...options })
}

/**
 * The contents of every note write so far, in order.
 */
function writes(): string[] {
  return noteFile.writes().map((write) => write.contents)
}

/**
 * The current contents of `path`, or `undefined` when no such file exists.
 */
function file(path: string): string | undefined {
  return noteFile.files().get(path)
}

/**
 * Deliver watcher changes to the open documents, and let the reads they start settle.
 */
async function emitChange(changes: FileChange[]): Promise<void> {
  app.fileChanges.emit({ changes, source: 'external' })
  // The test doubles answer in microtasks, so one task later nothing is pending.
  await new Promise((resolve) => setTimeout(resolve))
}

async function readyHook() {
  const hook = await mount(() => useNoteDocument('notes/a.md'))
  await vi.waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return hook
}

/**
 * Replace the files of the graph with `files`, and index the notes in `indexed`.
 */
function seedGraph(files: Record<string, string>, indexed: readonly string[] = []): void {
  for (const path of noteFile.files().keys()) {
    void noteFile.delete(path, 1)
  }
  for (const [path, contents] of Object.entries(files)) {
    noteFile.set(path, contents)
  }
  seedNotes(
    app.database,
    indexed.map((path) => ({ path, markdown: files[path] ?? '' })),
  )
}

/**
 * Hold every note write to `path` until the returned release runs, so a
 * background chain can be parked mid-flight. The browser-mode `unmount()`
 * awaits React's act (it flushes microtasks), which would otherwise run a
 * teardown chain to completion before the test can stage the next step.
 */
function gateWrites(path: string): () => void {
  const ungated = writeNote
  const gate = Promise.withResolvers<void>()
  writeNote = async (...args) => {
    if (args[0] === path) {
      await gate.promise
    }
    return await ungated(...args)
  }
  return gate.resolve
}

describe('useNoteDocument', () => {
  it('loads the note and seeds the editor content', async () => {
    const { result } = await readyHook()
    expect(result.current.initialContent).toBe('# Hello\n')
    expect(result.current.dirty).toBe(false)
  })

  it('debounces edits into an atomic write and clears dirty', async () => {
    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')

    await hook.act(() => hook.result.current.onEditorChange('# Hello edited\n'))
    expect(hook.result.current.dirty).toBe(true)
    expect(writes()).toEqual([])

    await hook.act(() => clock.advance(1000))
    expect(writes()).toEqual(['# Hello edited\n'])
    expect(hook.result.current.dirty).toBe(false)
  })

  it('flushOpenDocuments persists a pending edit without waiting out the debounce (quit path)', async () => {
    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')

    await hook.act(() => hook.result.current.onEditorChange('# Quitting\n'))
    expect(writes()).toEqual([]) // still inside the 800ms debounce window

    // The quit path: the registry flush settles only once the write has
    // landed — no timer advance, the way a ⌘Q teardown would run it.
    await hook.act(() => app.openDocuments.flushAll())
    expect(writes()).toEqual(['# Quitting\n'])
    expect(hook.result.current.dirty).toBe(false)
  })

  it('reconciles pending editor input before the editor handle unbinds', async () => {
    const hook = await readyHook()
    const editor = fakeEditor()
    const getMarkdown = vi.fn(() => {
      hook.result.current.onEditorChange('# 🧠 Business ideas\n')
      return '# 🧠 Business ideas\n'
    })
    editor.getMarkdown = getMarkdown

    await hook.act(() => hook.result.current.bindEditor(editor))
    await hook.act(() => hook.result.current.bindEditor(null))
    await hook.act(() => app.openDocuments.flushAll())

    expect(getMarkdown).toHaveBeenCalledOnce()
    expect(writes()).toEqual(['# 🧠 Business ideas\n'])
    await hook.unmount()
  })

  it('unmounting unregisters the buffer from the quit-flush registry', async () => {
    const hook = await readyHook()
    await hook.act(() => hook.result.current.onEditorChange('# Edited\n'))
    await hook.unmount() // unmount itself flushes once (the existing final-flush path)
    await hook.act(async () => {})
    const writesAfterUnmount = writes().length

    await app.openDocuments.flushAll() // the unmounted buffer must no longer be registered
    expect(writes().length).toBe(writesAfterUnmount)
  })

  it('a settled title change rewrites inbound links and records the alias (Plan 07b)', async () => {
    seedGraph(
      {
        'notes/a.md': managedNote('# Old Title\n'),
        'notes/src.md': 'see [[Old Title]]\n',
      },
      ['notes/a.md', 'notes/src.md'],
    )

    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')

    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000)) // the rename save lands

    // Blur is a settle point: the rewrite fires without waiting out the
    // quiet period, then the alias lands through the normal save pipeline.
    await hook.act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    await hook.act(() => runAllTimers())

    expect(file('notes/src.md')).toBe('see [[New Title]]\n')
    // The file followed its title (Plan 17): alias and content move along.
    expect(file('notes/a.md')).toBeUndefined()
    expect(file('notes/new-title.md')).toContain('aliases:')
    expect(file('notes/new-title.md')).toContain('Old Title')
    expect(file('notes/new-title.md')!.endsWith('# New Title\n')).toBe(true)
  })

  it('a rename settled by pane teardown still rewrites links and lands the alias', async () => {
    seedGraph(
      {
        'notes/a.md': managedNote('# Old Title\n'),
        'notes/src.md': 'see [[Old Title]]\n',
      },
      ['notes/a.md', 'notes/src.md'],
    )

    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000)) // save lands, quiet timer armed

    await hook.unmount() // teardown settles the tracker — the session is disposed
    await hook.act(() => runAllTimers())

    expect(file('notes/src.md')).toBe('see [[New Title]]\n')
    // The alias can't go through the disposed session — it lands on disk,
    // and the move then carries it to the slug path.
    expect(file('notes/new-title.md')).toContain('aliases:')
    expect(file('notes/new-title.md')).toContain('Old Title')
    expect(file('notes/a.md')).toBeUndefined()
  })

  it('a rename settling after a note switch never touches the new note', async () => {
    seedGraph(
      {
        'notes/a.md': managedNote('# Old Title\n'),
        'notes/b.md': '# Note B\n',
        'notes/src.md': 'see [[Old Title]]\n',
      },
      ['notes/a.md', 'notes/src.md'],
    )

    // Note A: edit the title, save lands, rename pending.
    const paneA = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await paneA.act(() => clock.advance(0))
    await paneA.act(() => paneA.result.current.onEditorChange('# New Title\n'))
    await paneA.act(() => clock.advance(1000))
    await paneA.unmount() // teardown settles A's rename asynchronously

    // Note B mounts immediately — the rename must not be able to see it.
    const paneB = await mount(() => useNoteDocument('notes/b.md', { trackRenames: true }))
    await paneB.act(() => runAllTimers())

    expect(file('notes/src.md')).toBe('see [[New Title]]\n')
    expect(file('notes/new-title.md')).toContain('aliases:') // alias on A, via disk
    expect(file('notes/b.md')).toBe('# Note B\n') // B untouched
    await paneB.unmount()
  })

  it('a title collision skips both the rewrite and the alias', async () => {
    seedGraph(
      {
        'notes/a.md': managedNote('# Old Title\n'),
        'notes/src.md': 'see [[Old Title]]\n',
        'notes/other-owner.md': '# Old Title\n', // another note owns "Old Title"
      },
      ['notes/other-owner.md', 'notes/src.md'],
    )

    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000))
    await hook.act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    await hook.act(() => runAllTimers())

    // Links keep resolving to their deliberate target; no competing alias.
    // The file still follows the NEW title — the guard is about the old
    // title's links, not the filename.
    expect(file('notes/src.md')).toBe('see [[Old Title]]\n')
    expect(file('notes/new-title.md')).toContain(`id: ${MANAGED_ID}`)
    expect(file('notes/new-title.md')!.endsWith('# New Title\n')).toBe(true)
    expect(file('notes/a.md')).toBeUndefined()
    await hook.unmount()
  })

  it('a failed rewrite still records the alias (the resolve safety net)', async () => {
    seedGraph({
      'notes/a.md': managedNote('# Old Title\n'),
      'notes/src.md': 'see [[Old Title]]\n',
    })
    // The rewrite cannot run.
    const unavailable = new Error('index unavailable')
    vi.spyOn(app.wikiResolver, 'getLinkSources').mockRejectedValue(unavailable)
    vi.spyOn(app.wikiResolver, 'getPathLinkSources').mockRejectedValue(unavailable)

    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000))
    await hook.act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    await hook.act(() => runAllTimers())

    // The rewrite failed, the baseline has advanced — the alias is what
    // keeps [[Old Title]] resolving here, so it must land regardless.
    expect(file('notes/src.md')).toBe('see [[Old Title]]\n')
    expect(file('notes/new-title.md')).toContain('aliases:')
    expect(file('notes/new-title.md')).toContain('Old Title')
    // The same broken link query also fails the path-link pass after the move.
    expect(logger.getErrors().map((entry) => entry.message)).toEqual([
      'rename link rewrite failed:',
      'path link rewrite failed:',
    ])
    await hook.unmount()
  })

  it('a lazy note\u{2019}s first heading never fires a rename', async () => {
    seedGraph({ 'notes/src.md': 'unrelated\n' }, ['notes/src.md'])
    const linkSources = vi.spyOn(app.wikiResolver, 'getLinkSources')
    const pathLinkSources = vi.spyOn(app.wikiResolver, 'getPathLinkSources')

    const placeholderPath = 'notes/01arz3ndektsv4rrffq69g5fav.md'
    const hook = await mount(() =>
      useNoteDocument(placeholderPath, {
        createIfMissing: true,
        trackRenames: true,
        missingSeed: managedNote('#\n'),
      }),
    )
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')

    await hook.act(() => hook.result.current.onEditorChange('# Brand New Note\n'))
    await hook.act(() => clock.advance(1000))
    await hook.act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    await hook.act(() => runAllTimers())

    // Titling an untitled note is a birth: no rewrite ran, no alias landed —
    // but the file shed its placeholder name for the title's slug (Plan 17).
    expect(linkSources).not.toHaveBeenCalled()
    expect(pathLinkSources).not.toHaveBeenCalled()
    expect(file('notes/brand-new-note.md')).toContain(`id: ${MANAGED_ID}`)
    expect(file('notes/brand-new-note.md')!.endsWith('# Brand New Note\n')).toBe(true)
    expect(file(placeholderPath)).toBeUndefined()
    await hook.unmount()
  })

  it('maintains links for an adopted retitle without moving its file', async () => {
    seedGraph(
      {
        'notes/adopted.md': '# Old Title\n',
        'notes/source.md': 'see [[Old Title]]\n',
      },
      ['notes/adopted.md', 'notes/source.md'],
    )
    const linkSources = vi.spyOn(app.wikiResolver, 'getLinkSources')
    const pathLinkSources = vi.spyOn(app.wikiResolver, 'getPathLinkSources')

    const hook = await mount(() => useNoteDocument('notes/adopted.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000))
    await hook.act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    await hook.act(() => runAllTimers())

    expect(file('notes/adopted.md')).toBe(
      upsertFrontmatter('# New Title\n', { aliases: ['Old Title'] }),
    )
    expect(file('notes/new-title.md')).toBeUndefined()
    expect(file('notes/source.md')).toBe('see [[New Title]]\n')
    expect(linkSources).toHaveBeenCalledOnce()
    expect(pathLinkSources).not.toHaveBeenCalled()
    await hook.unmount()
  })

  it('the pane adopts its retargeted session when the route follows a move (Plan 17)', async () => {
    seedGraph({ 'notes/a.md': managedNote('# Old Title\n') })

    const hook = await mount(
      ({ path }: { path: string } = { path: 'notes/a.md' }) =>
        useNoteDocument(path, { trackRenames: true }),
      { initialProps: { path: 'notes/a.md' } },
    )
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')
    const epochBefore = hook.result.current.sessionEpoch

    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000)) // save lands
    await hook.act(() => runAllTimers()) // quiet period → rename + move

    expect(app.noteMove.moved()).toEqual([['notes/a.md', 'notes/new-title.md']])
    // Alias frontmatter (the rename's breadcrumb) + content, at the slug path.
    expect(file('notes/new-title.md')).toContain('Old Title')
    expect(file('notes/new-title.md')).toContain('# New Title\n')
    expect(file('notes/a.md')).toBeUndefined()

    // The router (subscribed to the note moves) re-renders the pane with the
    // new path; the hook adopts the retargeted session — no reload, no new
    // epoch, so the live editor (and its cursor) survives.
    await hook.rerender({ path: 'notes/new-title.md' })
    await hook.act(async () => {})
    expect(hook.result.current.status).toBe('ready')
    expect(hook.result.current.sessionEpoch).toBe(epochBefore)

    // Subsequent edits land on the new path only — nothing resurrects a.md.
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n\nmore\n'))
    await hook.act(() => clock.advance(1000))
    expect(file('notes/new-title.md')).toContain('# New Title\n\nmore\n')
    expect(file('notes/a.md')).toBeUndefined()
    await hook.unmount()
  })

  it('watcher upserts at the retargeted path reconcile before React catches up (Plan 17)', async () => {
    seedGraph({ 'notes/a.md': managedNote('# Old Title\n') })
    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000))
    await hook.act(() => runAllTimers()) // rename + move settle; session retargeted

    // An external edit lands at the NEW path while the pane still renders
    // the old route path (no rerender yet) — it must reconcile against the
    // session's current path, not the stale prop.
    noteFile.set('notes/new-title.md', '# New Title\n\nedited elsewhere\n')
    await hook.act(() => emitChange([{ path: 'notes/new-title.md', kind: 'upsert' }]))
    await hook.act(() => runAllTimers())

    expect(hook.result.current.initialContent).toContain('edited elsewhere')
    await hook.unmount()
  })

  it('an unadopted retargeted session still tears down on unmount (no orphan flush)', async () => {
    seedGraph({ 'notes/a.md': managedNote('# Old Title\n') })

    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000))
    await hook.act(() => runAllTimers()) // move lands; session retargeted

    // Unmount without any rerender (nothing adopted the session): the
    // deferred teardown must still dispose it and flush nothing stale.
    await hook.unmount()
    await hook.act(async () => {})
    const after = noteFile.files()

    await app.openDocuments.flushAll() // an orphan would flush here and resurrect a.md
    expect(noteFile.files()).toEqual(after)
    expect(file('notes/a.md')).toBeUndefined()
  })

  it('alias placement preserves aliases gained while the rewrite ran', async () => {
    seedGraph(
      {
        'notes/a.md': managedNote('# Old Title\n'),
        'notes/src.md': 'see [[Old Title]]\n',
      },
      ['notes/a.md', 'notes/src.md'],
    )

    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000))

    const teardown = hook.unmount() // teardown settle → the alias lands via the disk path
    // An external writer adds an alias before the chain's placement read —
    // the settle-time snapshot doesn't know about it. The write has to land
    // before the unmount promise flushes the chain's continuation.
    noteFile.set('notes/a.md', '---\naliases:\n  - Keeper\n---\n# New Title\n')
    await teardown
    await hook.act(() => runAllTimers())

    expect(file('notes/new-title.md')).toContain('Keeper') // concurrently-gained, kept
    expect(file('notes/new-title.md')).toContain('Old Title') // the rename's alias
  })

  it('a teardown rename routes its alias through a reopened dirty session', async () => {
    seedGraph(
      {
        'notes/a.md': managedNote('# Old Title\n'),
        'notes/src.md': 'see [[Old Title]]\n',
      },
      ['notes/a.md', 'notes/src.md'],
    )

    const paneA = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await paneA.act(() => clock.advance(0))
    await paneA.act(() => paneA.result.current.onEditorChange('# New Title\n'))
    await paneA.act(() => clock.advance(1000))
    // Park the chain at its link rewrite so the reopen lands first, the way
    // it does in the app.
    const releaseRewrite = gateWrites('notes/src.md')
    await paneA.unmount() // settles the rename; its chain runs on

    // The same note is reopened immediately and edited before the chain's
    // alias placement runs.
    const paneA2 = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await paneA2.act(() => clock.advance(0))
    await paneA2.act(() => paneA2.result.current.onEditorChange('# New Title\n\nfresh edit\n'))
    releaseRewrite()
    await paneA2.act(() => runAllTimers())

    // The alias went through the live session — no conflict from our own
    // background write, and the user's edit and the alias both persist
    // (carried to the slug path by the move).
    expect(paneA2.result.current.conflict).toBeNull()
    expect(file('notes/new-title.md')).toContain('aliases:')
    expect(file('notes/new-title.md')).toContain('Old Title')
    expect(file('notes/new-title.md')).toContain('fresh edit')
    await paneA2.unmount()
  })

  it('quit-time flushOpenDocuments settles a pending rename before resolving', async () => {
    seedGraph(
      {
        'notes/a.md': managedNote('# Old Title\n'),
        'notes/src.md': 'see [[Old Title]]\n',
      },
      ['notes/a.md', 'notes/src.md'],
    )

    const hook = await mount(() => useNoteDocument('notes/a.md', { trackRenames: true }))
    await hook.act(() => clock.advance(0))
    await hook.act(() => hook.result.current.onEditorChange('# New Title\n'))
    await hook.act(() => clock.advance(1000)) // save lands, quiet timer armed

    // ⌘Q: the registry flush must settle the rename and await its writes.
    await hook.act(() => app.openDocuments.flushAll())

    expect(file('notes/src.md')).toBe('see [[New Title]]\n')
    expect(file('notes/new-title.md')).toContain('aliases:')
    await hook.unmount()
  })

  it('ignores the watcher echo of its own save', async () => {
    const { result, act } = await readyHook()
    const editor = fakeEditor()
    await act(() => result.current.bindEditor(editor))

    // The watcher reports our own write back; content matches disk state.
    await act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await act(async () => {})
    expect(editor.applied).toEqual([])
    expect(result.current.conflict).toBeNull()
  })

  it('reloads a clean buffer on a real external change', async () => {
    const { result, act } = await readyHook()
    const editor = fakeEditor()
    await act(() => result.current.bindEditor(editor))

    noteFile.set('notes/a.md', '# Changed outside\n')
    await act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await vi.waitFor(() => expect(editor.applied).toEqual(['# Changed outside\n']))
    expect(result.current.conflict).toBeNull()
    expect(result.current.dirty).toBe(false)
  })

  it('parks an external change as a conflict when the buffer is dirty', async () => {
    const { result, act } = await readyHook()
    const editor = fakeEditor()
    await act(() => result.current.bindEditor(editor))

    await act(() => result.current.onEditorChange('# My unsaved edit\n'))
    noteFile.set('notes/a.md', '# Theirs\n')
    await act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await vi.waitFor(() => expect(result.current.conflict).toBe('# Theirs\n'))
    expect(editor.applied).toEqual([]) // never clobbered

    // Load theirs: applies the external content and clears the conflict.
    await act(() => result.current.loadTheirs())
    expect(editor.applied).toEqual(['# Theirs\n'])
    expect(result.current.conflict).toBeNull()
    expect(result.current.dirty).toBe(false)
  })

  it('opens a note the editor would corrupt in protected mode and never saves it', async () => {
    // meowdown's converter mangles git conflict markers, so the guard must catch it.
    noteFile.set(
      'notes/tasks.md',
      '# Shared\n\n<<<<<<< this device\nedited on a\n=======\nedited on b\n>>>>>>> other device\n',
    )
    const hook = await mount(() => useNoteDocument('notes/tasks.md'))
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')
    expect(hook.result.current.protected).toBe(true)

    // Even if an edit somehow reaches the pipeline, nothing is written.
    await hook.act(() => hook.result.current.onEditorChange('mangled'))
    await hook.act(() => clock.advance(2000))
    expect(writes()).toEqual([])
  })

  it('an external change that introduces conflict markers flips the note protected', async () => {
    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))
    const editor = fakeEditor()
    await hook.act(() => hook.result.current.bindEditor(editor))
    expect(hook.result.current.protected).toBe(false)

    noteFile.set(
      'notes/a.md',
      '# Shared\n\n<<<<<<< this device\na\n=======\nb\n>>>>>>> other device\n',
    )
    await hook.act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await hook.act(() => clock.advance(0))

    expect(hook.result.current.protected).toBe(true)
    // The conflicted bytes never enter a live editor.
    expect(editor.applied).toEqual([])
  })

  it('a note documenting a conflict inside a fence stays editable and saves', async () => {
    const disk =
      '# How to resolve\n\n```\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n```\n'
    noteFile.set('notes/tasks.md', disk)
    const hook = await mount(() => useNoteDocument('notes/tasks.md'))
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')
    expect(hook.result.current.protected).toBe(false)

    // And it saves like any other note: the fenced markers are content.
    await hook.act(() => hook.result.current.onEditorChange(disk + '\nmore\n'))
    await hook.act(() => clock.advance(2000))
    expect(writes()).toHaveLength(1)
  })

  it('an external reload never dirties the buffer, even when serialization normalizes', async () => {
    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))

    // The editor's change handler fires synchronously inside setMarkdown and
    // reports a *normalized* serialization (extra trailing newline) — as the
    // real editor does for e.g. loose lists.
    const editor = fakeEditor()
    let normalizedMarkdown = ''
    const normalizing: typeof editor = {
      ...editor,
      getMarkdown: () => normalizedMarkdown,
      setMarkdown: (markdown) => {
        editor.setMarkdown(markdown)
        normalizedMarkdown = `${markdown}\n`
        hook.result.current.onEditorChange(normalizedMarkdown)
      },
    }
    await hook.act(() => hook.result.current.bindEditor(normalizing))

    noteFile.set('notes/a.md', '# Changed outside\n')
    await hook.act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await hook.act(() => clock.advance(0))
    expect(editor.applied).toEqual(['# Changed outside\n'])
    expect(hook.result.current.dirty).toBe(false)

    // No save may fire from the reload alone.
    await hook.act(() => clock.advance(5000))
    expect(writes()).toEqual([])

    // A persistence flush and ref teardown both ask Meowdown to reconcile,
    // but its unchanged normalized snapshot is not itself a user edit.
    await hook.act(() => app.openDocuments.flushAll())
    await hook.act(() => hook.result.current.bindEditor(null))
    await hook.act(() => clock.advance(0))
    expect(writes()).toEqual([])
  })

  it('pauses saves while a conflict is parked (no clobbering theirs)', async () => {
    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))

    // An edit schedules a save, then an external change parks a conflict
    // before the debounce fires.
    await hook.act(() => hook.result.current.onEditorChange('# Mine\n'))
    noteFile.set('notes/a.md', '# Theirs\n')
    await hook.act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.conflict).toBe('# Theirs\n')

    // Neither the pending debounce nor an explicit flush may write now.
    await hook.act(() => hook.result.current.onEditorChange('# Mine v2\n'))
    await hook.act(() => clock.advance(5000))
    expect(writes()).toEqual([])

    // Resolution unblocks: keepMine rewrites with the buffer.
    await hook.act(() => hook.result.current.keepMine())
    await hook.act(() => clock.advance(0))
    expect(writes()).toEqual(['# Mine v2\n'])
  })

  it('treats a watcher event for an in-flight save as an echo, not a conflict', async () => {
    // Make the write update the file synchronously but resolve later,
    // simulating the watcher event racing the IPC promise settlement.
    let resolveWrite: (() => void) | null = null
    writeNote = async (...args) => {
      const written = realWrite(...args)
      await new Promise<void>((resolve) => {
        resolveWrite = resolve
      })
      return await written
    }

    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))

    await hook.act(() => hook.result.current.onEditorChange('# Saved\n'))
    await hook.act(() => clock.advance(1000)) // write dispatched, unresolved
    expect(writes()).toEqual(['# Saved\n'])

    // User keeps typing (dirty again) while the watcher reports our write.
    await hook.act(() => hook.result.current.onEditorChange('# Saved and more\n'))
    await hook.act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.conflict).toBeNull() // echo, not a conflict

    await hook.act(() => {
      resolveWrite?.()
    })
    await hook.act(() => clock.advance(0))
  })

  it('a queued save re-checks the buffer at write time (revert during a slow write)', async () => {
    // First write hangs; the queued second save must re-evaluate when it runs.
    let resolveWrite: (() => void) | null = null
    let writeCount = 0
    writeNote = async (...args) => {
      const written = realWrite(...args)
      writeCount += 1
      if (writeCount === 1) {
        await new Promise<void>((resolve) => {
          resolveWrite = resolve
        })
      }
      return await written
    }

    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))

    await hook.act(() => hook.result.current.onEditorChange('# A\n'))
    await hook.act(() => clock.advance(1000)) // write1(A) dispatched, hanging
    expect(writes()).toEqual(['# A\n'])

    // More typing queues a second save; then the user reverts to A before
    // write1 settles. The queued step must NOT persist the stale "# B".
    await hook.act(() => hook.result.current.onEditorChange('# B\n'))
    await hook.act(() => clock.advance(1000))
    await hook.act(() => hook.result.current.onEditorChange('# A\n'))
    await hook.act(() => {
      resolveWrite?.()
    })
    await hook.act(() => clock.advance(2000))
    expect(writes()).toEqual(['# A\n']) // no stale second write
    expect(hook.result.current.dirty).toBe(false)
  })

  it('surfaces a failed save as error and clears it on the next success', async () => {
    let failNext = true
    writeNote = async (...args) => {
      if (failNext) {
        failNext = false
        throw new Error('disk full')
      }
      return await realWrite(...args)
    }

    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))

    await hook.act(() => hook.result.current.onEditorChange('# Edited\n'))
    await hook.act(() => clock.advance(1000))
    expect(hook.result.current.error).toMatch(/disk full/)
    expect(hook.result.current.status).toBe('ready') // editing continues

    // The next (successful) save clears the surfaced error.
    await hook.act(() => hook.result.current.onEditorChange('# Edited again\n'))
    await hook.act(() => clock.advance(1000))
    expect(hook.result.current.error).toBeNull()
    expect(writes()).toEqual(['# Edited again\n'])
  })

  it('flushes the previous note when the path switches (final-flush snapshot)', async () => {
    noteFile.set('notes/b.md', '# Hello\n')

    const hook = await mount(
      ({ path }: { path: string } = { path: 'notes/a.md' }) => useNoteDocument(path),
      {
        initialProps: { path: 'notes/a.md' },
      },
    )
    await hook.act(() => clock.advance(0))

    // Dirty edit, then switch notes before the debounce fires: the unmount
    // flush must persist the OLD note's buffer to the OLD path.
    await hook.act(() => hook.result.current.onEditorChange('# Unsaved on A\n'))
    await hook.rerender({ path: 'notes/b.md' })
    await hook.act(() => clock.advance(2000))

    expect(noteFile.getWrites('notes/a.md')).toContain('# Unsaved on A\n')
    expect(noteFile.getWrites('notes/b.md')).toEqual([])
  })

  it('reconciles pending editor input during a same-path session rebind', async () => {
    const hook = await mount(
      ({ createIfMissing }: { createIfMissing: boolean } = { createIfMissing: false }) =>
        useNoteDocument('notes/a.md', { createIfMissing }),
      { initialProps: { createIfMissing: false } },
    )
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')

    const editor = fakeEditor()
    let reconciled = false
    editor.getMarkdown = vi.fn(() => {
      if (!reconciled) {
        reconciled = true
        hook.result.current.onEditorChange('# Pending native input\n')
      }
      return '# Pending native input\n'
    })
    await hook.act(() => hook.result.current.bindEditor(editor))

    // Changing a session option recreates the session without unmounting the
    // editor. The outgoing session must remain discoverable while Meowdown
    // synchronously reports reconciled native input from getMarkdown().
    await hook.rerender({ createIfMissing: true })
    await hook.act(() => clock.advance(2000))

    expect(editor.getMarkdown).toHaveBeenCalled()
    expect(writes()).toContain('# Pending native input\n')
  })

  it('lazy notes open empty when missing and are created by the first save', async () => {
    const hook = await mount(() =>
      useNoteDocument('daily/2026-06-09.md', { createIfMissing: true }),
    )
    await hook.act(() => clock.advance(0))
    expect(hook.result.current.status).toBe('ready')
    expect(hook.result.current.initialContent).toBe('')
    expect(hook.result.current.dirty).toBe(false)
    expect(writes()).toEqual([]) // opening alone never creates the file

    await hook.act(() => hook.result.current.onEditorChange('first keystroke\n'))
    await hook.act(() => clock.advance(1000))
    expect(writes()).toEqual(['first keystroke\n'])
  })

  it('a missing non-lazy note is still an error', async () => {
    const hook = await mount(() => useNoteDocument('notes/gone.md'))
    await vi.waitFor(() => expect(hook.result.current.status).toBe('error'))
  })

  it('a same-graph generation bump keeps unsaved edits and saves with the new generation', async () => {
    const hook = await mount(() => useNoteDocument('notes/a.md'))
    await hook.act(() => clock.advance(0))

    // Reopening the same graph bumps the generation without remounting the
    // pane. The dirty buffer must survive (no dispose/reload-from-disk) and
    // the pending save must carry the NEW generation — a stale one would be
    // rejected by Rust and the edit silently lost.
    await hook.act(() => hook.result.current.onEditorChange('# Unsaved\n'))
    await hook.act(() => app.graphSession.setGraph({ generation: 2 }))
    expect(hook.result.current.dirty).toBe(true)

    await hook.act(() => clock.advance(1000))
    expect(noteFile.writes()).toEqual([
      { path: 'notes/a.md', contents: '# Unsaved\n', generation: 2 },
    ])
    expect(hook.result.current.dirty).toBe(false)
  })

  it('keepMine rewrites the file with the buffer', async () => {
    const { result, act } = await readyHook()
    await act(() => result.current.onEditorChange('# My unsaved edit\n'))
    noteFile.set('notes/a.md', '# Theirs\n')
    await act(() => emitChange([{ path: 'notes/a.md', kind: 'upsert' }]))
    await vi.waitFor(() => expect(result.current.conflict).toBe('# Theirs\n'))

    await act(() => result.current.keepMine())
    await vi.waitFor(() => expect(writes()).toContain('# My unsaved edit\n'))
    expect(result.current.conflict).toBeNull()
  })
})
