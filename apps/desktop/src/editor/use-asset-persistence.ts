import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type {
  FileInfo,
  FileLinkResolver,
  ImageUrlResolver,
  WikiEmbedResolver,
} from '@meowdown/core'
import type { AssetSaveError } from '@reflect/core'
import { useNoteAttachments } from '@/editor/use-note-attachments.ts'
import { useAppServices } from '@/services/services-provider.tsx'

export type { AssetSaveError }

export interface AssetPersistence {
  /** Resolve an image source in the note to a displayable URL, possibly later. */
  resolveImageUrl: ImageUrlResolver
  /**
   * Resolve an image source or link destination in the note to the
   * graph-relative attachment {@link openAsset} opens (null for remote,
   * note, and unsafe destinations).
   */
  resolveAssetOpenPath: (src: string) => string | null
  /** Classify the note's `![[embeds]]` (see `useNoteAttachments`). */
  resolveWikiEmbed: WikiEmbedResolver
  /** Claim the note's links to local attachments as file pills. */
  resolveFileLink: FileLinkResolver
  /**
   * Open a vetted graph-relative asset path in the OS default application.
   * A refused file type degrades to revealing the file in the OS file
   * manager; a failed open surfaces on the status line, never a rejection.
   */
  openAsset: (path: string) => Promise<void>
  /**
   * Persist a pasted/dropped file into `assets/`, returning its graph-relative
   * path, or null when failed (the failure lands on
   * {@link AssetPersistence.saveError}, never a throw) or no graph is open.
   */
  saveFile: (file: File) => Promise<string | null>
  /**
   * Resolve the size a file pill shows for a claimed attachment link or
   * embed; undefined for anything else or a file the catalog doesn't list.
   */
  resolveFileInfo: (href: string) => Promise<FileInfo | undefined>
  /** The most recent failed save; cleared by the next success. */
  saveError: AssetSaveError | null
}

/**
 * Asset handling for the note at `path` in one open graph, through the
 * `AttachmentService`. `generation` pins every save and image URL to the
 * issuing graph session; `path` also scopes the error banner to the note
 * being edited (a pane is reused across note switches).
 */
export function useAssetPersistence(generation: number | null, path: string): AssetPersistence {
  const { attachments } = useAppServices()
  const { resolveImageUrl, resolveWikiEmbed } = useNoteAttachments(generation, path)
  // The pane outlives the note (and graph session) it shows, so a save that
  // finishes after a switch must not put its outcome on the next note's banner.
  const saveScope = useMemo(() => attachments.createSaveScope(), [attachments])
  const subscribeSaveError = useCallback(
    (listener: () => void) => saveScope.subscribe(listener),
    [saveScope],
  )
  const getSaveError = useCallback(() => saveScope.error(), [saveScope])
  const saveError = useSyncExternalStore(subscribeSaveError, getSaveError)

  useEffect(() => {
    return () => {
      saveScope.reset()
    }
  }, [saveScope, path, generation])

  const resolveAssetOpenPath = useCallback(
    (source: string): string | null => attachments.resolveAssetOpenPath(path, source, generation),
    [attachments, generation, path],
  )
  const resolveFileLink = useCallback<FileLinkResolver>(
    ({ href }) => attachments.claimsFileLink(path, href),
    [attachments, path],
  )

  const openAsset = useCallback(
    async (assetPath: string): Promise<void> => {
      if (generation !== null) {
        await attachments.openOrReveal(assetPath, generation)
      }
    },
    [attachments, generation],
  )

  const saveFile = useCallback(
    async (file: File): Promise<string | null> =>
      generation === null ? null : await saveScope.saveFile(file, generation),
    [saveScope, generation],
  )

  const resolveFileInfo = useCallback(
    async (href: string): Promise<FileInfo | undefined> =>
      await attachments.resolveFileInfo(path, href, generation),
    [attachments, generation, path],
  )

  return useMemo<AssetPersistence>(
    () => ({
      resolveImageUrl,
      resolveAssetOpenPath,
      resolveWikiEmbed,
      resolveFileLink,
      openAsset,
      saveFile,
      resolveFileInfo,
      saveError,
    }),
    [
      resolveImageUrl,
      resolveAssetOpenPath,
      resolveWikiEmbed,
      resolveFileLink,
      openAsset,
      saveFile,
      resolveFileInfo,
      saveError,
    ],
  )
}
