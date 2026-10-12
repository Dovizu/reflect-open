import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestClockService } from '../testing/clock.ts'
import { createTestNoteSession } from '../testing/documents.ts'
import { createTestNoteFileService, type TestNoteFileService } from '../testing/graph.ts'
import { createTestLoggerService } from '../testing/logger.ts'
import {
  createNoteSessionService,
  type NoteSession,
  type NoteSessionSnapshot,
} from './note-session.ts'
import { createOpenDocumentsService, type OpenDocumentsService } from './open-documents-service.ts'

/** A session that logs the calls the registry makes. */
function fakeSession(path: string, log: string[]): NoteSession {
  return {
    ...createTestNoteSession({ path }),
    externalChanged: () => {
      log.push(`externalChanged:${path}`)
    },
    flush: async () => {
      log.push(`flush:${path}`)
    },
  }
}

let openDocuments: OpenDocumentsService

beforeEach(() => {
  openDocuments = createOpenDocumentsService()
})

describe('open documents', () => {
  it('looks up the live session by path and forgets it on unregister', () => {
    const session = fakeSession('notes/a.md', [])
    const unregister = openDocuments.register({ session })
    expect(openDocuments.sessionFor('notes/a.md')).toBe(session)
    unregister()
    expect(openDocuments.sessionFor('notes/a.md')).toBeNull()
  })

  it('a reopened path replaces the entry; the old unregister cannot evict it', () => {
    const first = fakeSession('notes/a.md', [])
    const second = fakeSession('notes/a.md', [])
    const unregisterFirst = openDocuments.register({ session: first })
    const unregisterSecond = openDocuments.register({ session: second })
    unregisterFirst() // stale unregister after the reopen — must be a no-op
    expect(openDocuments.sessionFor('notes/a.md')).toBe(second)
    unregisterSecond()
  })

  it('flushAll flushes, then settles, then awaits the settle work', async () => {
    const log: string[] = []
    const unregister = openDocuments.register({
      session: fakeSession('notes/a.md', log),
      settle: () => {
        log.push('settle')
      },
      settled: async () => {
        await Promise.resolve()
        log.push('settled')
      },
    })
    try {
      await openDocuments.flushAll()
      expect(log).toEqual(['flush:notes/a.md', 'settle', 'settled'])
    } finally {
      unregister()
    }
  })

  it('reloadAll asks every open session to reconcile against disk', () => {
    const log: string[] = []
    const unregisterA = openDocuments.register({ session: fakeSession('notes/a.md', log) })
    const unregisterB = openDocuments.register({ session: fakeSession('notes/b.md', log) })
    try {
      openDocuments.reloadAll()
      expect(log).toEqual(['externalChanged:notes/a.md', 'externalChanged:notes/b.md'])
    } finally {
      unregisterA()
      unregisterB()
    }
  })

  it('one failing document does not block the others, and nothing rejects', async () => {
    const log: string[] = []
    const failing = fakeSession('notes/bad.md', log)
    failing.flush = async () => {
      throw new Error('disk full')
    }
    const unregisterBad = openDocuments.register({ session: failing })
    const unregisterGood = openDocuments.register({ session: fakeSession('notes/good.md', log) })
    try {
      await expect(openDocuments.flushAll()).resolves.toBeUndefined()
      expect(log).toContain('flush:notes/good.md')
    } finally {
      unregisterBad()
      unregisterGood()
    }
  })
})

describe('retarget (Plan 17)', () => {
  it('re-keys the entry; the original unregister still finds it by identity', async () => {
    const session = fakeSession('notes/a.md', [])
    const unregister = openDocuments.register({ session })

    openDocuments.retarget('notes/a.md', 'notes/renamed.md', session)
    expect(openDocuments.sessionFor('notes/a.md')).toBeNull()
    expect(openDocuments.sessionFor('notes/renamed.md')).toBe(session)

    unregister() // registered under a.md, re-keyed since — must still evict
    expect(openDocuments.sessionFor('notes/renamed.md')).toBeNull()
  })

  it('re-keying a path with no entry is a no-op', async () => {
    openDocuments.retarget(
      'notes/ghost.md',
      'notes/elsewhere.md',
      fakeSession('notes/ghost.md', []),
    )
    expect(openDocuments.sessionFor('notes/elsewhere.md')).toBeNull()
  })

  it("never re-keys a different pane's document at the same path", async () => {
    // The failed-move compensation re-keys (to → from); when the entry at
    // `to` belongs to another pane, it must stay exactly where it is.
    const foreign = fakeSession('notes/taken.md', [])
    const unregister = openDocuments.register({ session: foreign })
    try {
      openDocuments.retarget('notes/taken.md', 'notes/old.md', fakeSession('notes/taken.md', []))
      expect(openDocuments.sessionFor('notes/taken.md')).toBe(foreign)
      expect(openDocuments.sessionFor('notes/old.md')).toBeNull()
    } finally {
      unregister()
    }
  })
})

describe('reloadAll with live sessions', () => {
  // The iOS resume bug: the index reconcile re-reads a remotely edited note
  // into the index but emits no `index:changed`, so nothing ever told the open
  // session and it kept showing stale content until the app was relaunched.
  // These pin the whole path with real sessions: content changes on disk, no
  // file event fires, the reload converges the editor.

  const PATH = 'notes/stale.md'

  function liveSession(
    noteFile: TestNoteFileService,
    applied: string[],
    snapshots: NoteSessionSnapshot[],
  ): NoteSession {
    return createNoteSessionService({
      noteFile,
      clock: createTestClockService(),
      logger: createTestLoggerService(),
    }).create({
      path: PATH,
      // No generation: the session tracks dirtiness but never writes, so a
      // dirty buffer can't race a debounced save into the assertions.
      generation: null,
      classify: () => 'exact',
      onSnapshot: (snapshot) => {
        snapshots.push(snapshot)
      },
      applyContent: (markdown) => {
        applied.push(markdown)
      },
    })
  }

  it('a clean open note adopts the new disk content silently', async () => {
    const noteFile = createTestNoteFileService({ files: { [PATH]: '# Old\n' } })
    const applied: string[] = []
    const snapshots: NoteSessionSnapshot[] = []
    const session = liveSession(noteFile, applied, snapshots)
    const unregister = openDocuments.register({ session })
    try {
      session.load()
      await vi.waitFor(() => expect(snapshots.at(-1)?.status).toBe('ready'))

      noteFile.set(PATH, '# New from the Mac\n') // the reconcile saw this; no index:changed fired
      openDocuments.reloadAll()

      await vi.waitFor(() => expect(applied).toContain('# New from the Mac\n'))
      expect(snapshots.at(-1)?.conflict).toBeNull()
    } finally {
      unregister()
      session.dispose()
    }
  })

  it('a dirty open note parks the conflict banner instead of losing edits', async () => {
    const noteFile = createTestNoteFileService({ files: { [PATH]: '# Old\n' } })
    const snapshots: NoteSessionSnapshot[] = []
    const session = liveSession(noteFile, [], snapshots)
    const unregister = openDocuments.register({ session })
    try {
      session.load()
      await vi.waitFor(() => expect(snapshots.at(-1)?.status).toBe('ready'))
      session.editorChanged('# Old\nmy unsaved line\n')

      noteFile.set(PATH, '# New from the Mac\n')
      openDocuments.reloadAll()

      await vi.waitFor(() => expect(snapshots.at(-1)?.conflict).toBe('# New from the Mac\n'))
      expect(snapshots.at(-1)?.dirty).toBe(true)
    } finally {
      unregister()
      session.discard() // never flush the deliberately-dirty buffer
    }
  })

  it('an unchanged file is a no-op read: no editor push, no conflict', async () => {
    const applied: string[] = []
    const snapshots: NoteSessionSnapshot[] = []
    const noteFile = createTestNoteFileService({ files: { [PATH]: '# Old\n' } })
    const session = liveSession(noteFile, applied, snapshots)
    const unregister = openDocuments.register({ session })
    try {
      session.load()
      await vi.waitFor(() => expect(snapshots.at(-1)?.status).toBe('ready'))
      const settled = snapshots.length

      openDocuments.reloadAll()
      await new Promise((resolve) => setTimeout(resolve, 0)) // drain the reconcile read

      expect(applied).toEqual([])
      expect(snapshots).toHaveLength(settled) // the echo guard emitted nothing
    } finally {
      unregister()
      session.dispose()
    }
  })
})
