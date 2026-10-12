import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { ReflectError, resolveConflictMarkers, type GraphInfo } from '@reflect/core'
import {
  createTestAppServices,
  createTestFileChangeService,
  createTestIndexLifecycleService,
  createTestNoteFileService,
  type TestFileChangeService,
  type TestIndexLifecycleService,
  type TestNoteFileService,
} from '@reflect/core/testing'
import { invalidateIndexQueries } from '@/lib/query-client.ts'
import { AppServicesProvider } from '@/services/services-provider.tsx'
import { useConflictResolution } from './use-conflict-resolution.ts'

vi.mock('@/lib/query-client.ts', () => ({ invalidateIndexQueries: vi.fn() }))

const graphState = vi.hoisted(() => ({
  graph: { root: '/g', name: 'G', generation: 3 } as GraphInfo | null,
  indexGeneration: 7 as number | null,
}))
vi.mock('@/providers/graph-provider.tsx', () => ({ useGraph: () => graphState }))

const PATH = 'notes/clash.md'
const SOURCE = [
  '<<<<<<< this device',
  'mine',
  '=======',
  'theirs',
  '>>>>>>> other device',
  '',
].join('\n')

let noteFile: TestNoteFileService
let fileChanges: TestFileChangeService
let indexLifecycle: TestIndexLifecycleService
let indexed: Array<{ path: string; generation: number; content: string | undefined }>

beforeEach(() => {
  graphState.graph = { root: '/g', name: 'G', generation: 3 }
  graphState.indexGeneration = 7
  noteFile = createTestNoteFileService({ files: { [PATH]: SOURCE } })
  fileChanges = createTestFileChangeService()
  indexed = []
  indexLifecycle = {
    ...createTestIndexLifecycleService({ noteFile, fileChanges }),
    indexNote: async (path, options) => {
      indexed.push({ path, generation: options.generation, content: options.content })
    },
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

/** Render the hook over app services built on the fakes above. */
async function mount(overrides?: { noteFile?: TestNoteFileService }) {
  const app = createTestAppServices({
    noteFile: overrides?.noteFile ?? noteFile,
    fileChanges,
    indexLifecycle,
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppServicesProvider services={app}>{children}</AppServicesProvider>
  )
  return await renderHook(() => useConflictResolution(PATH), { wrapper })
}

describe('useConflictResolution', () => {
  it('writes the spliced side, reindexes, and notifies open views', async () => {
    const { result, act } = await mount()

    await act(async () => {
      await result.current.resolve('ours')
    })

    const resolved = resolveConflictMarkers(SOURCE, 'ours')
    expect(noteFile.writes()).toEqual([{ path: PATH, contents: resolved, generation: 3 }])
    expect(indexed).toEqual([{ path: PATH, generation: 7, content: resolved }])
    expect(fileChanges.batches()).toEqual([
      { changes: [{ path: PATH, kind: 'upsert' }], source: 'own-write' },
    ])
    expect(vi.mocked(invalidateIndexQueries)).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    expect(result.current.busy).toBe(false)
  })

  it('a failed write surfaces the error and notifies nothing', async () => {
    const { result, act } = await mount({
      noteFile: {
        ...noteFile,
        write: async () => {
          throw new ReflectError('io', 'disk full')
        },
      },
    })

    await act(async () => {
      await result.current.resolve('theirs')
    })

    expect(result.current.error).toBe('disk full')
    expect(result.current.busy).toBe(false)
    expect(fileChanges.batches()).toEqual([])
    expect(vi.mocked(invalidateIndexQueries)).not.toHaveBeenCalled()
  })

  it('a failed reindex still notifies — the file on disk did change', async () => {
    indexLifecycle.indexNote = async () => {
      throw new ReflectError('io', 'index closed')
    }
    const { result, act } = await mount()

    await act(async () => {
      await result.current.resolve('both')
    })

    expect(result.current.error).toBe('index closed')
    expect(fileChanges.batches()).toHaveLength(1)
    expect(vi.mocked(invalidateIndexQueries)).toHaveBeenCalled()
  })

  it('does nothing without an open graph', async () => {
    graphState.graph = null
    const { result, act } = await mount()

    await act(async () => {
      await result.current.resolve('ours')
    })

    expect(noteFile.writes()).toEqual([])
    expect(fileChanges.batches()).toEqual([])
    expect(vi.mocked(invalidateIndexQueries)).not.toHaveBeenCalled()
  })
})
