import { describe, expect, it } from 'vitest'
import { ReflectError } from '../errors.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { ExistingWikiTargetResolution } from '../graph/note-link-resolver-service.ts'
import type { FileMeta } from '../graph/schemas.ts'
import {
  createTestAssetStoreService,
  createTestAttachmentService,
  createTestClockService,
  createTestDialogService,
  createTestFileChangeService,
  createTestNoteFileService,
  createTestNoteLinkResolverService,
  createTestNoteSession,
  createTestOperationsService,
  createTestPlatformService,
} from '../testing/index.ts'
import { createAttachmentService } from './attachment-service.ts'
import { createNoteDocumentService } from './note-document-service.ts'
import { createTestGraphSessionService } from '../testing/graph-session.ts'
import { createNotePreviewService, type NotePreviewServiceDeps } from './note-preview-service.ts'
import { createOpenDocumentsService } from './open-documents-service.ts'

/**
 * A test graph session with a graph of generation 7 open.
 */
function openGraph() {
  return createTestGraphSessionService({ graph: { generation: 7 } })
}

function previewAssetUrl(generation: number, path: string): string {
  return `reflect-asset://localhost/${encodeURIComponent(`${generation}/${path}`)}?reflect-preview=raster`
}

/**
 * The real service over a link resolver and note documents over `noteFile` (empty by default).
 */
function notePreviewOver(
  options?: Partial<NotePreviewServiceDeps> & { noteFile?: NoteFileService },
) {
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  return createNotePreviewService({
    noteLinkResolver: options?.noteLinkResolver ?? createTestNoteLinkResolverService({ noteFile }),
    noteDocuments:
      options?.noteDocuments ??
      createNoteDocumentService({
        openDocuments: createOpenDocumentsService({ fileChanges: createTestFileChangeService() }),
        noteFile,
      }),
    attachments: options?.attachments ?? createTestAttachmentService(),
    graphSession: options?.graphSession ?? openGraph(),
  })
}

/**
 * A real `AttachmentService` whose catalog lists `listing()`.
 */
function attachmentsOver(listing: () => Promise<readonly { path: string; size: number }[]>) {
  const clock = createTestClockService()
  const noteFile: NoteFileService = Object.assign(createTestNoteFileService(), {
    async listAttachments(): Promise<FileMeta[]> {
      return (await listing()).map((entry) => ({ ...entry, modifiedMs: 0 }))
    },
  })
  return createAttachmentService({
    assetStore: createTestAssetStoreService(),
    noteFile,
    fileChanges: createTestFileChangeService(),
    dialog: createTestDialogService(),
    operations: createTestOperationsService(clock),
    clock,
    platform: createTestPlatformService(),
    graphSession: openGraph(),
  })
}

describe('previewWikiTarget', () => {
  it('previews an existing target without its frontmatter', async () => {
    const noteFile = createTestNoteFileService({
      files: { 'notes/alpha.md': '---\nprivate: true\n---\n# Alpha\n\nBody' },
    })
    const noteLinkResolver = createTestNoteLinkResolverService({ noteFile })
    const notePreview = notePreviewOver({ noteFile, noteLinkResolver })

    const preview = await notePreview.previewWikiTarget('Alpha')

    expect(preview).toMatchObject({ path: 'notes/alpha.md', markdown: '# Alpha\n\nBody' })
    expect(noteLinkResolver.calls()).toMatchObject([
      { kind: 'wiki', target: 'Alpha', generation: 7 },
    ])
  })

  it('reads the open session before the disk', async () => {
    const noteFile = createTestNoteFileService({
      files: { 'notes/alpha.md': '# Alpha\n\nOn disk' },
    })
    const openDocuments = createOpenDocumentsService({ fileChanges: createTestFileChangeService() })
    openDocuments.register({
      session: createTestNoteSession({ path: 'notes/alpha.md', content: '# Alpha\n\nLive' }),
    })
    const notePreview = notePreviewOver({
      noteFile,
      noteDocuments: createNoteDocumentService({ openDocuments, noteFile }),
    })

    await expect(notePreview.previewWikiTarget('Alpha')).resolves.toMatchObject({
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
      const notePreview = notePreviewOver({
        noteLinkResolver: { resolveWikiTarget: async () => resolution },
        noteDocuments: {
          readExisting: async () => {
            reads += 1
            return ''
          },
        },
      })
      await expect(notePreview.previewWikiTarget('Target')).resolves.toBeNull()
    }
    expect(reads).toBe(0)
  })

  it('resolves null instead of rejecting when resolution or the read fails', async () => {
    const failingResolution = notePreviewOver({
      noteLinkResolver: {
        resolveWikiTarget: async () => {
          throw new Error('index gone')
        },
      },
    })
    await expect(failingResolution.previewWikiTarget('Alpha')).resolves.toBeNull()

    const failingRead = notePreviewOver({
      noteLinkResolver: {
        resolveWikiTarget: async () => ({ kind: 'resolved', path: 'notes/alpha.md' }),
      },
      noteDocuments: {
        readExisting: async () => {
          throw new ReflectError('notFound', 'gone')
        },
      },
    })
    await expect(failingRead.previewWikiTarget('Alpha')).resolves.toBeNull()
  })

  it('serves only local sniffable raster images to the preview', async () => {
    const noteFile = createTestNoteFileService({ files: { 'notes/alpha.md': '# Alpha' } })
    const notePreview = notePreviewOver({
      noteFile,
      attachments: attachmentsOver(async () => []),
    })

    const preview = await notePreview.previewWikiTarget('Alpha')

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
      graphSession: openGraph(),
    })

    const preview = await notePreview.previewWikiTarget('Garden redesign')

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
    const notePreview = notePreviewOver({
      noteFile,
      attachments: attachmentsOver(() => listing.promise),
    })
    const preview = await notePreview.previewWikiTarget('Alpha')

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

describe('with no graph open', () => {
  it('previews nothing', async () => {
    const noteFile = createTestNoteFileService({ files: { 'notes/alpha.md': '# Alpha' } })
    const notePreview = notePreviewOver({
      noteFile,
      graphSession: createTestGraphSessionService(),
    })

    await expect(notePreview.previewWikiTarget('Alpha')).resolves.toBeNull()
  })
})
