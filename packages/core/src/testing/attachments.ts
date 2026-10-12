import { appleFileSrc } from '../app/platform-service.ts'
import {
  createAttachmentSaveScope,
  isManagedAssetPath,
  wikiEmbedDisplay,
  type AssetSaveError,
  type AssetSaveResult,
  type AttachFilesRequest,
  type AttachmentService,
} from '../documents/attachment-service.ts'
import { assetFileName } from '../graph/asset-names.ts'
import {
  createAttachmentCatalog,
  resolveAttachmentLink,
  type AttachmentCatalog,
} from '../graph/attachment-resolution.ts'

export interface TestAttachmentEntry {
  path: string
  size: number
}

export interface TestAttachmentServiceOptions {
  /** The attachment listing every generation's catalog is built from. */
  catalog?: readonly TestAttachmentEntry[]
  /** Make `openOrReveal` fall back to a reveal, as for a refused file type. */
  refuseOpen?: boolean
}

export interface AttachmentSave {
  name: string
  type: string
  size: number
  generation: number
  path: string
}

export interface TestAttachmentService extends AttachmentService {
  /** Replace the listing without notifying `onCatalogChanged` listeners. */
  setCatalog(entries: readonly TestAttachmentEntry[]): void
  /** Notify every `onCatalogChanged` listener. */
  emitCatalogChanged(): void
  /** Make later saves fail with `error`; `null` makes them succeed again. */
  failSaves(error: AssetSaveError | null): void
  /** Every successful save, in order. */
  saves(): readonly AttachmentSave[]
  /** Every path opened, in order. */
  opened(): readonly string[]
  /** Every path revealed, in order. */
  revealed(): readonly string[]
  /** Every `attachFilesToNote` request, in order. */
  attachRequests(): readonly AttachFilesRequest[]
  /** How many `watchCatalog` subscriptions are active. */
  watchers(): number
}

/**
 * An in-memory {@link AttachmentService} whose catalog is always loaded.
 * Saves land at `assets/<sanitized name>`; image URLs use the Apple
 * `reflect-asset://localhost/` shape.
 */
export function createTestAttachmentService(
  options?: TestAttachmentServiceOptions,
): TestAttachmentService {
  let catalog: AttachmentCatalog = createAttachmentCatalog(options?.catalog ?? [])
  let saveFailure: AssetSaveError | null = null
  let watching = 0
  const listeners = new Set<() => void>()
  const saveLog: AttachmentSave[] = []
  const openLog: string[] = []
  const revealLog: string[] = []
  const attachLog: AttachFilesRequest[] = []

  function resolveAttachmentPath(
    notePath: string,
    destination: string,
    generation: number | null,
  ): string | null {
    return generation === null ? null : resolveAttachmentLink(notePath, destination, catalog)
  }

  function resolveImageUrl(
    notePath: string,
    source: string,
    generation: number | null,
  ): string | undefined {
    if (/^https?:\/\//i.test(source)) {
      return source
    }
    const path = resolveAttachmentPath(notePath, source, generation)
    return path === null || generation === null
      ? undefined
      : appleFileSrc(`${generation}/${path}`, 'reflect-asset')
  }

  async function saveFile(file: File, generation: number): Promise<AssetSaveResult> {
    if (saveFailure !== null) {
      return { ok: false, error: saveFailure }
    }
    const path = `assets/${assetFileName(file.name)}`
    saveLog.push({ name: file.name, type: file.type, size: file.size, generation, path })
    return { ok: true, path }
  }

  return {
    peekCatalog: () => catalog,
    loadCatalog: async () => catalog,
    watchCatalog() {
      watching += 1
      return () => {
        watching -= 1
      }
    },
    onCatalogChanged(listener) {
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    resolveAttachmentPath,
    resolveAssetOpenPath(notePath, source, generation) {
      if (generation === null) {
        return null
      }
      return (
        resolveAttachmentPath(notePath, source, generation) ??
        (isManagedAssetPath(source) ? source : null)
      )
    },
    resolveImageUrl,
    async resolvePreviewImageUrl(notePath, source, generation) {
      const path = resolveAttachmentPath(notePath, source, generation)
      if (path === null || path.toLowerCase().endsWith('.svg')) {
        return
      }
      const url = resolveImageUrl(notePath, source, generation)
      return url === undefined ? undefined : `${url}?reflect-preview=raster`
    },
    resolveWikiEmbed: wikiEmbedDisplay,
    claimsFileLink: (notePath, href) =>
      isManagedAssetPath(href) || resolveAttachmentLink(notePath, href, null) !== null,
    async resolveFileInfo(notePath, href, generation) {
      const path = resolveAttachmentPath(notePath, href, generation)
      const size = path === null ? undefined : catalog.size(path)
      return size === undefined ? undefined : { size }
    },
    saveFile,
    createSaveScope: () => createAttachmentSaveScope(saveFile),
    async attachFilesToNote(request) {
      attachLog.push(request)
    },
    async openOrReveal(path) {
      if (options?.refuseOpen === true) {
        revealLog.push(path)
      } else {
        openLog.push(path)
      }
    },
    setCatalog(entries) {
      catalog = createAttachmentCatalog(entries)
    },
    emitCatalogChanged() {
      for (const listener of listeners) {
        listener()
      }
    },
    failSaves(error) {
      saveFailure = error
    },
    saves: () => [...saveLog],
    opened: () => [...openLog],
    revealed: () => [...revealLog],
    attachRequests: () => [...attachLog],
    watchers: () => watching,
  }
}
