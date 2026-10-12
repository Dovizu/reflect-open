import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { setDefaultNoteFile, type NoteFileService } from '../graph/note-file-service.ts'
import { createTestNoteFileService, type TestNoteFileService } from '../testing/index.ts'
import {
  gatherAssetDescriptionBodies,
  gatherAssetDescriptionText,
  MAX_ASSET_TEXT_CHARS,
} from './asset-description-text.ts'

let noteFile: TestNoteFileService
let readNoteMock: MockInstance<NoteFileService['readLocal']>

beforeEach(() => {
  noteFile = createTestNoteFileService()
  readNoteMock = vi.spyOn(noteFile, 'readLocal')
  setDefaultNoteFile(noteFile)
})

afterEach(() => {
  setDefaultNoteFile(null)
})

describe('gatherAssetDescriptionText', () => {
  it('returns empty for no assets', async () => {
    expect(await gatherAssetDescriptionText([])).toBe('')
  })

  it('reads each asset description body, stripping frontmatter, joined', async () => {
    noteFile.set(
      'assets/a.png.reflect.md',
      '---\nreflectAsset: true\nsource: assets/a.png\n---\n\nA flow diagram of the pipeline.\n',
    )
    noteFile.set('assets/b.pdf.reflect.md', '---\nreflectAsset: true\n---\n\nQ4 revenue report.\n')

    const text = await gatherAssetDescriptionText(['assets/a.png', 'assets/b.pdf'])

    expect(text).toBe('A flow diagram of the pipeline.\n\nQ4 revenue report.')
    expect(text).not.toContain('reflectAsset')
  })

  it('skips assets with no description file', async () => {
    noteFile.set('assets/a.png.reflect.md', '---\nreflectAsset: true\n---\n\nDescribed.\n')
    // assets/b.pdf has no description yet
    expect(await gatherAssetDescriptionText(['assets/a.png', 'assets/b.pdf'])).toBe('Described.')
  })

  it('folds an asset referenced twice only once', async () => {
    noteFile.set('assets/a.png.reflect.md', '---\nreflectAsset: true\n---\n\nOnce.\n')
    expect(await gatherAssetDescriptionText(['assets/a.png', 'assets/a.png'])).toBe('Once.')
    expect(readNoteMock).toHaveBeenCalledTimes(1)
  })

  it('also folds a user-authored description file (no managed marker)', async () => {
    noteFile.set(
      'assets/a.png.reflect.md',
      '# My own caption\n\nHand-written notes about this image.\n',
    )
    const text = await gatherAssetDescriptionText(['assets/a.png'])
    expect(text).toContain('Hand-written notes about this image.')
  })

  it('caps the combined text', async () => {
    noteFile.set('assets/a.png.reflect.md', 'x'.repeat(MAX_ASSET_TEXT_CHARS + 5_000))
    const text = await gatherAssetDescriptionText(['assets/a.png'])
    expect(text.length).toBe(MAX_ASSET_TEXT_CHARS)
  })

  it('skips an iCloud-evicted description instead of forcing a download', async () => {
    noteFile.set('assets/b.pdf.reflect.md', '---\nreflectAsset: true\n---\n\nStill local.\n')
    noteFile.set('assets/a.png.reflect.md', 'Not local.')
    noteFile.evict('assets/a.png.reflect.md')
    const text = await gatherAssetDescriptionText(['assets/a.png', 'assets/b.pdf'])
    expect(text).toBe('Still local.')
  })

  it('propagates a non-notFound read error', async () => {
    readNoteMock.mockRejectedValueOnce({ kind: 'io', message: 'disk error' })
    await expect(gatherAssetDescriptionText(['assets/a.png'])).rejects.toMatchObject({ kind: 'io' })
  })
})

describe('gatherAssetDescriptionBodies', () => {
  it('returns per-asset bodies attributed to their asset paths', async () => {
    noteFile.set('assets/a.png.reflect.md', '---\nreflectAsset: true\n---\n\nA flow diagram.\n')
    noteFile.set('assets/b.pdf.reflect.md', '---\nreflectAsset: true\n---\n\nQ4 revenue report.\n')

    const { bodies, evicted } = await gatherAssetDescriptionBodies(['assets/a.png', 'assets/b.pdf'])

    expect(bodies).toEqual([
      { assetPath: 'assets/a.png', body: 'A flow diagram.' },
      { assetPath: 'assets/b.pdf', body: 'Q4 revenue report.' },
    ])
    expect(evicted).toEqual([])
  })

  it('skips missing descriptions, empty bodies, and repeated assets', async () => {
    noteFile.set('assets/a.png.reflect.md', '---\nreflectAsset: true\n---\n\nDescribed.\n')
    noteFile.set('assets/empty.png.reflect.md', '---\nreflectAsset: true\n---\n\n  \n')

    const { bodies } = await gatherAssetDescriptionBodies([
      'assets/a.png',
      'assets/a.png',
      'assets/empty.png',
      'assets/missing.pdf',
    ])

    expect(bodies).toEqual([{ assetPath: 'assets/a.png', body: 'Described.' }])
    expect(readNoteMock).toHaveBeenCalledTimes(3) // the repeat never re-reads
  })

  it('stops accumulating once the combined length reaches the cap', async () => {
    noteFile.set('assets/a.png.reflect.md', 'x'.repeat(MAX_ASSET_TEXT_CHARS))
    noteFile.set('assets/b.png.reflect.md', 'never reached')

    const { bodies } = await gatherAssetDescriptionBodies(['assets/a.png', 'assets/b.png'])

    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.assetPath).toBe('assets/a.png')
  })

  it('reports an evicted sidecar so full-replace consumers can skip the write', async () => {
    noteFile.set('assets/b.pdf.reflect.md', '---\nreflectAsset: true\n---\n\nStill local.\n')
    noteFile.set('assets/a.png.reflect.md', 'Not local.')
    noteFile.evict('assets/a.png.reflect.md')

    const { bodies, evicted } = await gatherAssetDescriptionBodies(['assets/a.png', 'assets/b.pdf'])

    expect(bodies).toEqual([{ assetPath: 'assets/b.pdf', body: 'Still local.' }])
    expect(evicted).toEqual(['assets/a.png'])
  })
})
