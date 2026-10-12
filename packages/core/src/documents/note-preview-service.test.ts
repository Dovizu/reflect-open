import { afterEach, describe, expect, it } from 'vitest'
import { ReflectError } from '../errors.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { ExistingWikiTargetResolution } from '../graph/note-link-resolver-service.ts'
import type { FileMeta } from '../graph/schemas.ts'
import {
  createTestAssetStoreService,
  createTestClockService,
  createTestDialogService,
  createTestFileChangeService,
  createTestNoteDocumentService,
  createTestNoteFileService,
  createTestNoteLinkResolverService,
  createTestNotePreviewService,
  createTestOpenDocumentsService,
  createTestNoteSession,
  createTestOperationsService,
  createTestPlatformService,
  installTestServices,
  createTestAppServices,
} from '../testing/index.ts'
import { createAttachmentService } from './attachment-service.ts'
import {
  createNotePreviewService,
  defaultNotePreview,
  setDefaultNotePreview,
} from './note-preview-service.ts'

function previewAssetUrl(generation: number, path: string): string {
  return `reflect-asset://localhost/${encodeURIComponent(`${generation}/${path}`)}?reflect-preview=raster`
}

/** A real `AttachmentService` whose catalog lists `listing()`. */
function attachmentsOver(listing: () => Promise<readonly { path: string; size: number }[]>) {
  const clock = createTestClockService()
  const noteFile: NoteFileService = {
    ...createTestNoteFileService(),
    async listAttachments(): Promise<FileMeta[]> {
      return (await listing()).map((entry) => ({ ...entry, modifiedMs: 0 }))
    },
  }
  return createAttachmentService({
    assetStore: createTestAssetStoreService(),
    noteFile,
    fileChanges: createTestFileChangeService(),
    dialog: createTestDialogService(),
    operations: createTestOperationsService(clock),
    clock,
    platform: createTestPlatformService(),
  })
}

describe('previewWikiTarget', () => {
  it('previews an existing target without its frontmatter', async () => {
    const noteFile = createTestNoteFileService({
      files: { 'notes/alpha.md': '---\nprivate: true\n---\n# Alpha\n\nBody' },
    })
    const noteLinkResolver = createTestNoteLinkResolverService({ noteFile })
    const notePreview = createTestNotePreviewService({ noteFile, noteLinkResolver })

    const preview = await notePreview.previewWikiTarget('Alpha', 7)

    expect(preview).toMatchObject({ path: 'notes/alpha.md', markdown: '# Alpha\n\nBody' })
    expect(noteLinkResolver.calls()).toMatchObject([
      { kind: 'wiki', target: 'Alpha', generation: 7 },
    ])
  })

  it('reads the open session before the disk', async () => {
    const noteFile = createTestNoteFileService({
      files: { 'notes/alpha.md': '# Alpha\n\nOn disk' },
    })
    const openDocuments = createTestOpenDocumentsService({
      sessions: [createTestNoteSession({ path: 'notes/alpha.md', content: '# Alpha\n\nLive' })],
    })
    const notePreview = createTestNotePreviewService({
      noteFile,
      noteDocuments: createTestNoteDocumentService({ openDocuments, noteFile }),
    })

    await expect(notePreview.previewWikiTarget('Alpha', 7)).resolves.toMatchObject({
      markdown: '# Alpha\n\nLive',
    })
  })

  it('resolves null for missing, ambiguous, and unavailable targets without reading', async () => {
    const resolutions: ExistingWikiTargetResolution[] = [
      { kind: 'missing' },
      { kind: 'ambiguous', paths: ['notes/a.md', 'notes/b.md'] },
      { kind: 'unavailable', paths: ['notes/a.md'] },
    ]
    let reads = 0
    for (const resolution of resolutions) {
      const notePreview = createTestNotePreviewService({
        noteLinkResolver: { resolveWikiTarget: async () => resolution },
        noteDocuments: {
          readExisting: async () => {
            reads += 1
            return ''
          },
        },
      })
      await expect(notePreview.previewWikiTarget('Target', 7)).resolves.toBeNull()
    }
    expect(reads).toBe(0)
  })

  it('resolves null instead of rejecting when resolution or the read fails', async () => {
    const failingResolution = createTestNotePreviewService({
      noteLinkResolver: {
        resolveWikiTarget: async () => {
          throw new Error('index gone')
        },
      },
    })
    await expect(failingResolution.previewWikiTarget('Alpha', 7)).resolves.toBeNull()

    const failingRead = createTestNotePreviewService({
      noteLinkResolver: {
        resolveWikiTarget: async () => ({ kind: 'resolved', path: 'notes/alpha.md' }),
      },
      noteDocuments: {
        readExisting: async () => {
          throw new ReflectError('notFound', 'gone')
        },
      },
    })
    await expect(failingRead.previewWikiTarget('Alpha', 7)).resolves.toBeNull()
  })

  it('serves only local sniffable raster images to the preview', async () => {
    const noteFile = createTestNoteFileService({ files: { 'notes/alpha.md': '# Alpha' } })
    const notePreview = createTestNotePreviewService({
      noteFile,
      attachments: attachmentsOver(async () => []),
    })

    const preview = await notePreview.previewWikiTarget('Alpha', 7)

    expect(await preview?.resolveImageUrl('https://example.com/cat.png')).toBeUndefined()
    expect(await preview?.resolveImageUrl('../../outside.png')).toBeUndefined()
    expect(await preview?.resolveImageUrl('assets/vector.svg')).toBeUndefined()
    expect(await preview?.resolveImageUrl('assets/cat.png')).toBe(
      previewAssetUrl(7, 'assets/cat.png'),
    )
  })

  it("resolves the target note's images and embeds from its own folder", async () => {
    const notePreview = createNotePreviewService({
      noteLinkResolver: {
        resolveWikiTarget: async () => ({ kind: 'resolved', path: 'Projects/Garden redesign.md' }),
      },
      noteDocuments: { readExisting: async () => '![[garden-budget.png]]' },
      attachments: attachmentsOver(async () => []),
    })

    const preview = await notePreview.previewWikiTarget('Garden redesign', 7)

    expect(await preview?.resolveImageUrl('../attachments/garden-budget.png')).toBe(
      previewAssetUrl(7, 'attachments/garden-budget.png'),
    )
    expect(preview?.resolveWikiEmbed('garden-budget.png')).toEqual({
      kind: 'image',
      src: 'garden-budget.png',
    })
    expect(preview?.resolveWikiEmbed('Deep Work')).toEqual({ kind: 'note' })
  })

  it('waits for the catalog before resolving a bare image embed', async () => {
    const listing = Promise.withResolvers<readonly { path: string; size: number }[]>()
    const noteFile = createTestNoteFileService({ files: { 'notes/alpha.md': '![[photo.png]]' } })
    const notePreview = createTestNotePreviewService({
      noteFile,
      attachments: attachmentsOver(() => listing.promise),
    })
    const preview = await notePreview.previewWikiTarget('Alpha', 7)

    const image = preview?.resolveWikiEmbed('photo.png')
    if (image?.kind !== 'image') {
      throw new Error('Missing image source')
    }
    const url = preview?.resolveImageUrl(image.src)
    let settled = false
    void Promise.resolve(url).then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    listing.resolve([{ path: 'Media/photo.png', size: 42 }])
    await expect(url).resolves.toBe(previewAssetUrl(7, 'Media/photo.png'))
  })
})

describe('readExistingNoteSource', () => {
  it('reads an existing note through the note documents', async () => {
    const noteFile = createTestNoteFileService({ files: { 'notes/alpha.md': '# Alpha' } })
    const notePreview = createTestNotePreviewService({ noteFile })

    await expect(notePreview.readExistingNoteSource('notes/alpha.md', 7)).resolves.toBe('# Alpha')
  })
})

describe('defaultNotePreview', () => {
  afterEach(() => {
    setDefaultNotePreview(null)
  })

  it('reads the default services of the moment', async () => {
    const service = defaultNotePreview()
    const app = createTestAppServices()
    app.noteFile.set('notes/alpha.md', '# Alpha\n\nBody')
    const restore = installTestServices(app)
    setDefaultNotePreview(null)

    await expect(service.previewWikiTarget('Alpha', 1)).resolves.toMatchObject({
      path: 'notes/alpha.md',
    })
    restore()
  })

  it('returns an installed service', () => {
    const installed = createTestNotePreviewService()
    setDefaultNotePreview(installed)
    expect(defaultNotePreview()).toBe(installed)
  })
})
