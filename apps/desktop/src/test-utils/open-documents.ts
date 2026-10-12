import { afterEach, beforeEach } from 'vitest'
import { setDefaultOpenDocuments, type NoteSession, type OpenDocumentsService } from '@reflect/core'
import { createTestOpenDocumentsService } from '@reflect/core/testing'

export interface TestOpenDocuments {
  /**
   * Register `session` as an open document and return the unregister. A
   * stand-in that has no `path` gets `path`.
   */
  open(session: Partial<NoteSession>, path?: string): () => void
  /** The registry of the running test. */
  service(): OpenDocumentsService
}

/**
 * Give every test of the calling file a fresh open-documents registry,
 * installed as the process-wide default. Call it at the top level of a test
 * file.
 */
export function installTestOpenDocuments(): TestOpenDocuments {
  let current: OpenDocumentsService = createTestOpenDocumentsService()

  beforeEach(() => {
    current = createTestOpenDocumentsService()
    setDefaultOpenDocuments(current)
  })

  afterEach(() => {
    setDefaultOpenDocuments(null)
  })

  return {
    open(session, path = 'notes/a.md') {
      const target = session.path === undefined ? Object.assign(session, { path }) : session
      // A stand-in implements only what the code under test calls.
      return current.register({ session: target as NoteSession })
    },
    service: () => current,
  }
}
