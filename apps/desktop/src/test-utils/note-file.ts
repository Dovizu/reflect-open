import { afterEach, beforeEach, vi, type MockInstance } from 'vitest'
import { setDefaultNoteFile, type NoteFileService } from '@reflect/core'
import { createTestNoteFileService, type TestNoteFileService } from '@reflect/core/testing'

export interface TestNoteFile {
  /** The in-memory note files of the running test. */
  service(): TestNoteFileService
  /** The spy on `read` of the running test. */
  read(): MockInstance<NoteFileService['read']>
  /** The spy on `write` of the running test. */
  write(): MockInstance<NoteFileService['write']>
}

/**
 * Give every test of the calling file a fresh in-memory `NoteFileService`,
 * installed as the process-wide default, with `read` and `write` spied. Call
 * it at the top level of a test file.
 */
export function installTestNoteFile(): TestNoteFile {
  let current = createTestNoteFileService()
  let read = vi.spyOn(current, 'read')
  let write = vi.spyOn(current, 'write')

  beforeEach(() => {
    current = createTestNoteFileService()
    read = vi.spyOn(current, 'read')
    write = vi.spyOn(current, 'write')
    setDefaultNoteFile(current)
  })

  afterEach(() => {
    setDefaultNoteFile(null)
  })

  return {
    service: () => current,
    read: () => read,
    write: () => write,
  }
}
