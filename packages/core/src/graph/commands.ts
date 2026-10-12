import { defaultWebFetch } from '../app/web-fetch-service.ts'
import { defaultWindow } from '../app/window-service.ts'
import type { CloudSafe } from '../privacy/cloud-safe.ts'
import { defaultAssetStore } from './asset-store-service.ts'
import { defaultNoteFile, type LocalNoteRead, type VaultScanStats } from './note-file-service.ts'
import type { FileMeta, NoteCreateOutcome, WindowBootstrap } from './schemas.ts'

export type { LocalNoteRead, VaultScanStats } from './note-file-service.ts'

/**
 * Adopt the already-open graph for a secondary note window: a pure read of
 * the current graph + index sessions (never `graph_open`/`index_open`, whose
 * generation bumps would strand the main window's pinned commands) plus the
 * one-shot deep link the window was created for. Errors when no graph is open.
 */
export async function windowBootstrap(): Promise<WindowBootstrap> {
  return await defaultWindow().bootstrap()
}

/** `defaultNoteFile().read`. */
export async function readNote(path: string, generation?: number): Promise<string> {
  return await defaultNoteFile().read(path, generation)
}

/** `defaultNoteFile().readLocal`. */
export async function readNoteLocal(path: string, generation?: number): Promise<LocalNoteRead> {
  return await defaultNoteFile().readLocal(path, generation)
}

/** `defaultNoteFile().write`, without its result. */
export async function writeNote(
  path: string,
  contents: string,
  generation: number,
  expectedContents?: string | null,
): Promise<void> {
  await defaultNoteFile().write(path, contents, generation, expectedContents)
}

/** `defaultNoteFile().create`. */
export async function createNoteIfAbsent(
  path: string,
  contents: string,
  generation: number,
): Promise<NoteCreateOutcome> {
  return await defaultNoteFile().create(path, contents, generation)
}

/** `defaultAssetStore().writeBase64`. */
export async function writeAsset(
  path: string,
  contentsBase64: string,
  generation: number,
): Promise<void> {
  await defaultAssetStore().writeBase64(path, contentsBase64, generation)
}

/** `defaultAssetStore().readBase64`. */
export async function readAsset(path: string, generation: number): Promise<string> {
  return await defaultAssetStore().readBase64(path, generation)
}

/** `defaultAssetStore().readBytes`. */
export async function readAssetBinary(
  path: string,
  generation: number,
): Promise<Uint8Array<ArrayBuffer>> {
  return await defaultAssetStore().readBytes(path, generation)
}

/** `defaultAssetStore().readTranscriptCache`. */
export async function readTranscriptCache(name: string, generation: number): Promise<string> {
  return await defaultAssetStore().readTranscriptCache(name, generation)
}

/** `defaultAssetStore().writeTranscriptCache`. */
export async function writeTranscriptCache(
  name: string,
  contents: string,
  generation: number,
): Promise<void> {
  await defaultAssetStore().writeTranscriptCache(name, contents, generation)
}

/** `defaultAssetStore().deleteAudioMemo`. */
export async function deleteAudioMemo(path: string, generation: number): Promise<void> {
  await defaultAssetStore().deleteAudioMemo(path, generation)
}

/** `defaultAssetStore().importAudioMemo`. */
export async function importAudioMemo(
  sourcePath: string,
  path: string,
  generation: number,
): Promise<void> {
  await defaultAssetStore().importAudioMemo(sourcePath, path, generation)
}

/** `defaultAssetStore().open`. */
export async function openAsset(path: string, generation: number): Promise<void> {
  await defaultAssetStore().open(path, generation)
}

/** `defaultAssetStore().reveal`. */
export async function revealAsset(path: string, generation: number): Promise<void> {
  await defaultAssetStore().reveal(path, generation)
}

/** `defaultNoteFile().listDir`. */
export async function listDir(dir: string, generation: number): Promise<FileMeta[]> {
  return await defaultNoteFile().listDir(dir, generation)
}

/** `defaultNoteFile().exists`. */
export async function noteExists(path: string): Promise<boolean> {
  return await defaultNoteFile().exists(path)
}

/** `defaultNoteFile().delete`. */
export async function deleteNote(path: string, generation: number): Promise<void> {
  await defaultNoteFile().delete(path, generation)
}

/** `defaultNoteFile().listNotes`. */
export async function listFiles(generation?: number): Promise<FileMeta[]> {
  return await defaultNoteFile().listNotes(generation)
}

/** `defaultNoteFile().listAttachments`. */
export async function listAttachments(generation?: number): Promise<FileMeta[]> {
  return await defaultNoteFile().listAttachments(generation)
}

/** `defaultNoteFile().vaultScanStats`. */
export async function vaultScanStats(generation?: number): Promise<VaultScanStats> {
  return await defaultNoteFile().vaultScanStats(generation)
}

/**
 * Fetch an oEmbed endpoint's JSON answer as text. The Rust side only bounds
 * the transport (https only, JSON only, a small byte cap, no redirects);
 * which URLs are oEmbed endpoints is policy in `actions/oembed`. The privacy
 * gate runs before any call here.
 */
export async function captureOEmbedFetch(url: string): Promise<string> {
  return await defaultWebFetch().fetchOembed(url as CloudSafe<string>)
}
