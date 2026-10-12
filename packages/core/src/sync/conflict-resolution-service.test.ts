import { beforeEach, describe, expect, it } from 'vitest'
import { ReflectError } from '../errors.ts'
import { resolveConflictMarkers } from '../markdown/conflict-markers.ts'
import { createTestFileChangeService, type TestFileChangeService } from '../testing/file-change.ts'
import { createTestNoteFileService, type TestNoteFileService } from '../testing/graph.ts'
import {
  createConflictResolutionService,
  type ConflictResolutionService,
} from './conflict-resolution-service.ts'

const PATH = 'notes/clash.md'
const SOURCE = [
  '<<<<<<< this device',
  'mine',
  '=======',
  'theirs',
  '>>>>>>> other device',
  '',
].join('\n')
const SESSION = { generation: 3, indexGeneration: 7 }

let noteFile: TestNoteFileService
let fileChanges: TestFileChangeService
let indexed: Array<{ path: string; generation: number; content: string | undefined }>
let failIndex: boolean
let service: ConflictResolutionService

beforeEach(() => {
  noteFile = createTestNoteFileService({ files: { [PATH]: SOURCE } })
  fileChanges = createTestFileChangeService()
  indexed = []
  failIndex = false
  service = createConflictResolutionService({
    noteFile,
    indexLifecycle: {
      indexNote: async (path, options) => {
        if (failIndex) {
          throw new ReflectError('io', 'index closed')
        }
        indexed.push({ path, generation: options.generation, content: options.content })
      },
    },
    fileChanges,
  })
})

describe('createConflictResolutionService', () => {
  it('writes the spliced side, reindexes, and notifies open sessions', async () => {
    const outcome = await service.resolve(PATH, 'ours', SESSION)

    const resolved = resolveConflictMarkers(SOURCE, 'ours')
    expect(outcome).toEqual({ wrote: true, error: null })
    expect(noteFile.writes()).toEqual([{ path: PATH, contents: resolved, generation: 3 }])
    expect(indexed).toEqual([{ path: PATH, generation: 7, content: resolved }])
    expect(fileChanges.batches()).toEqual([
      { changes: [{ path: PATH, kind: 'upsert' }], source: 'own-write' },
    ])
  })

  it('a failed write reports the error and notifies nothing', async () => {
    const outcome = await createConflictResolutionService({
      noteFile: {
        read: (path) => noteFile.read(path),
        write: async () => {
          throw new ReflectError('io', 'disk full')
        },
      },
      indexLifecycle: { indexNote: async () => {} },
      fileChanges,
    }).resolve(PATH, 'theirs', SESSION)

    expect(outcome).toEqual({ wrote: false, error: 'disk full' })
    expect(fileChanges.batches()).toEqual([])
  })

  it('a missing note reports the error and writes nothing', async () => {
    const outcome = await service.resolve('notes/missing.md', 'ours', SESSION)

    expect(outcome.wrote).toBe(false)
    expect(outcome.error).not.toBeNull()
    expect(noteFile.writes()).toEqual([])
    expect(fileChanges.batches()).toEqual([])
  })

  it('a failed reindex still notifies — the file on disk did change', async () => {
    failIndex = true

    const outcome = await service.resolve(PATH, 'both', SESSION)

    expect(outcome).toEqual({ wrote: true, error: 'index closed' })
    expect(noteFile.getWrites(PATH)).toEqual([resolveConflictMarkers(SOURCE, 'both')])
    expect(fileChanges.batches()).toHaveLength(1)
  })

  it('skips the reindex without an open index session', async () => {
    const outcome = await service.resolve(PATH, 'ours', { generation: 3, indexGeneration: null })

    expect(outcome).toEqual({ wrote: true, error: null })
    expect(indexed).toEqual([])
    expect(fileChanges.batches()).toHaveLength(1)
  })
})
