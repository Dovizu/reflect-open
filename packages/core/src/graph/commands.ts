import { z } from 'zod'
import { defaultLogger } from '../app/logger-service.ts'
import { defaultWebFetch } from '../app/web-fetch-service.ts'
import { defaultWindow } from '../app/window-service.ts'
import { echoLocalWrite } from '../indexing/local-write-echo.ts'
import { getBridge, type Unlisten } from '../ipc/bridge.ts'
import { call } from '../ipc/invoke.ts'
import type { CloudSafe } from '../privacy/cloud-safe.ts'
import { defaultAssetStore } from './asset-store-service.ts'
import { defaultCaptureInbox } from './capture-inbox-service.ts'
import { defaultNoteFile, type LocalNoteRead, type VaultScanStats } from './note-file-service.ts'
import {
  graphImportProgressSchema,
  graphImportSummarySchema,
  graphInfoSchema,
  type FileMeta,
  type GraphImportProgress,
  type GraphImportSummary,
  type GraphInfo,
  type NoteCreateOutcome,
  type WindowBootstrap,
} from './schemas.ts'

export type { LocalNoteRead, VaultScanStats } from './note-file-service.ts'

/** Commands that return `()` from Rust serialize as `null` over IPC. */
const voidSchema = z.null()

/**
 * Adopt the already-open graph for a secondary note window: a pure read of
 * the current graph + index sessions (never `graph_open`/`index_open`, whose
 * generation bumps would strand the main window's pinned commands) plus the
 * one-shot deep link the window was created for. Errors when no graph is open.
 */
export async function windowBootstrap(): Promise<WindowBootstrap> {
  return await defaultWindow().bootstrap()
}

/** Create a new graph at `path` and open it. */
export async function createGraph(path: string): Promise<GraphInfo> {
  return await call('graph_create', { path }, graphInfoSchema)
}

/**
 * Import a Reflect V1 export `.zip` into the open graph. V1 exports already use
 * Reflect Open's graph-folder layout; Rust extracts safe entries under the
 * active graph root without ever replacing an existing file (identical files
 * skip, conflicting notes rename, conflicting daily notes merge). Attachments
 * the notes link to on Firebase Storage or Reflect's asset CDN are downloaded
 * into `assets/` and the links rewritten, so the call can take a while on
 * attachment-heavy graphs — observe {@link subscribeImportProgress} and offer
 * {@link cancelReflectV1Import} while it runs.
 */
export async function importReflectV1Zip(
  path: string,
  generation: number,
): Promise<GraphImportSummary> {
  return await call('graph_import_reflect_v1_zip', { path, generation }, graphImportSummarySchema)
}

/** Event name the running import emits {@link GraphImportProgress} ticks on. */
export const IMPORT_PROGRESS_EVENT = 'import:progress'

/** Live progress ticks of the running Reflect V1 import. */
export function subscribeImportProgress(
  handler: (progress: GraphImportProgress) => void,
): Promise<Unlisten> {
  return getBridge().listen(IMPORT_PROGRESS_EVENT, (payload) => {
    const parsed = graphImportProgressSchema.safeParse(payload)
    if (parsed.success) {
      handler(parsed.data)
    } else {
      defaultLogger().error('invalid import:progress payload:', parsed.error)
    }
  })
}

/**
 * Cancel the running Reflect V1 import (a no-op when none runs). The import
 * aborts before anything lands in the graph, so cancelling is always safe;
 * the pending {@link importReflectV1Zip} call rejects.
 */
export async function cancelReflectV1Import(): Promise<void> {
  await call('graph_import_cancel', {}, voidSchema)
}

/**
 * Mark files imported by {@link importReflectV1Zip} as this device's writes.
 * Call only after the UI confirms the imported graph is still the active graph:
 * these paths are graph-relative and the own-write channel is scoped to the
 * currently running iCloud controller.
 */
export function markReflectV1ImportOwnWrites(summary: GraphImportSummary): void {
  const modifiedMs = Date.now()
  for (const changedPath of summary.changedPaths) {
    echoLocalWrite({ path: changedPath, kind: 'upsert', modifiedMs })
  }
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
 * Point the capture host at the active graph (pointer file + inbox dir) and
 * rewrite native-messaging manifests for detected browsers. Called after
 * every graph open — rewriting self-heals app moves (Plan 11).
 */
export async function captureHostRegister(): Promise<void> {
  await defaultCaptureInbox().registerHost()
}

/**
 * List the capture inbox (`.reflect/inbox/`): spooled `.json` envelopes and
 * their screenshot siblings. A missing inbox lists as empty. Pinned to
 * `generation` like every background-pass read.
 */
export async function captureInboxList(generation: number): Promise<FileMeta[]> {
  return await defaultCaptureInbox().list(generation)
}

/** Read one spooled envelope's JSON text by spool filename (e.g. `<id>.json`). */
export async function captureInboxRead(name: string, generation: number): Promise<string> {
  return await defaultCaptureInbox().read(name, generation)
}

/**
 * Spool an envelope this app produced (deep-link text captures) into the
 * inbox, atomically — it then flows through the same watcher-triggered drain
 * as browser captures. The caller validates the envelope shape; the Rust side
 * only moves bytes (with a defensive size cap).
 */
export async function captureInboxSpool(
  name: string,
  json: string,
  generation: number,
): Promise<void> {
  await defaultCaptureInbox().spool(name, json, generation)
}

/** Remove a spool file by filename. Idempotent — crash re-drains re-remove. */
export async function captureInboxRemove(name: string, generation: number): Promise<void> {
  await defaultCaptureInbox().remove(name, generation)
}

/**
 * Relay envelopes the iOS share extension spooled into the App Group inbox
 * into the graph's capture inbox, returning how many moved. iOS-only in
 * effect (elsewhere there is no shared container and the relay is zero);
 * called by the mobile capture controller before every drain pass.
 */
export async function captureSharedInboxRelay(generation: number): Promise<number> {
  return await defaultCaptureInbox().relaySharedInbox(generation)
}

/**
 * Quarantine an unparseable spool file into `.reflect/inbox-rejected/` —
 * moved, never deleted: "the raw link is never lost" holds even for an
 * envelope a newer extension wrote that this app version can't read yet.
 */
export async function captureInboxReject(name: string, generation: number): Promise<void> {
  await defaultCaptureInbox().reject(name, generation)
}

/**
 * Copy a spooled screenshot into the graph as a downscaled JPEG asset (the
 * spool file stays until the drain removes it — crash-safe copy semantics).
 */
export async function promoteCaptureScreenshot(
  spoolName: string,
  assetPath: string,
  maxDim: number,
  generation: number,
): Promise<void> {
  await defaultCaptureInbox().promoteScreenshot(spoolName, assetPath, maxDim, generation)
}

/**
 * Ask the native platform for one representative image for a captured URL.
 * Returns a base64-encoded normalized JPEG, or `null` when unavailable.
 */
export async function captureLinkPreview(url: string): Promise<string | null> {
  return await defaultWebFetch().fetchLinkPreviewImage(url as CloudSafe<string>)
}

/**
 * Fetch a captured page's HTML for meta-tag scraping — the Rust side caps
 * scheme/timeout/size/redirects, so arbitrary capture URLs never widen the
 * webview's own HTTP capability. The privacy gate runs before any call here.
 */
export async function captureMetaFetch(url: string): Promise<string> {
  return await defaultWebFetch().fetchMeta(url as CloudSafe<string>)
}

/**
 * Fetch an oEmbed endpoint's JSON answer as text. The Rust side only bounds
 * the transport (https only, JSON only, a small byte cap, no redirects);
 * which URLs are oEmbed endpoints is policy in `actions/oembed`. The privacy
 * gate runs before any call here, exactly as for {@link captureMetaFetch}.
 */
export async function captureOEmbedFetch(url: string): Promise<string> {
  return await defaultWebFetch().fetchOembed(url as CloudSafe<string>)
}
