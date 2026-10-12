import { appendXPost } from '../actions/bookmark-capture.ts'
import type { XPostEnvelope } from '../actions/bookmark-envelope.ts'
import { isCaptureSpoolPath } from '../actions/capture-identity.ts'
import type { AiCredentialService } from '../ai/ai-credential-service.ts'
import type { AiProviderConfigService } from '../ai/ai-provider-config-service.ts'
import type { PageDescriberService } from '../ai/page-describer-service.ts'
import type { BackgroundReconcilerFactory } from '../app/background-reconciler.ts'
import type { ClockService } from '../app/clock-service.ts'
import type { HashService } from '../app/hash-service.ts'
import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { PlatformFacts } from '../app/platform-service.ts'
import { isMobilePlatform } from '../app/platform.ts'
import { isSilentStop, type ReconcileStop } from '../app/reconcile.ts'
import type { WebFetchService } from '../app/web-fetch-service.ts'
import type { OpenDocumentsService } from '../documents/open-documents-service.ts'
import { errorMessage, isAppError, toAppError } from '../errors.ts'
import type { AssetStoreService } from '../graph/asset-store-service.ts'
import type { CaptureInboxService } from '../graph/capture-inbox-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { FileChangeService } from '../indexing/file-change-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { PrivacyService } from '../privacy/privacy-service.ts'
import type { XArchiveService } from '../x-archive.ts'
import type { BacklinkTargetService } from './backlink-target-service.ts'
import { createCaptureDrainService } from './capture-drain-service.ts'
import { createCaptureEnrichmentService } from './capture-enrichment-service.ts'
import { createPageMetaService } from './page-meta-service.ts'

/**
 * The link-capture lifecycle for one graph session. Built on
 * `BackgroundReconcilerFactory` (shared with transcription and asset
 * descriptions): the single-flight loop, focus/online retries, and teardown live
 * there; this supplies the capture-specific pass and triggers.
 *
 * Every pass runs the two capture phases in order: **drain** the spool inbox
 * (the durable raw save — works without any AI configured), then **enrich**
 * pending captures (meta scrape + BYOK description). The launch pass is the
 * headline behavior: captures spooled while the app was closed land the
 * moment a graph opens.
 */
export interface CaptureSession {
  /**
   * Register the native-messaging host (desktop), then attach the triggers
   * (watcher, focus, online) and run the launch pass.
   */
  start(): void
  /** Request a pass; coalesces while one runs (at most one follow-up). */
  schedule(): void
  /** Tear down triggers and abort an in-flight pass at its next gate. */
  dispose(): void
}

export interface CaptureSessionOptions {
  /** The open graph's generation — every pass's reads and writes pin to it. */
  generation: number
}

/**
 * Link capture (Plan 11): lands the captures spooled by the browser
 * extension, the iOS share extension, Shortcuts and deep links in the daily
 * note, then enriches them. Capture has no in-app surface; the daily note is
 * the output.
 *
 * On desktop every session first registers the native-messaging host (pointer
 * file + browser manifests, rewritten on every graph open so app moves
 * self-heal). On the mobile surface there is no native-messaging host to
 * register; instead every pass first relays the App Group inbox the iOS share
 * extension spools into, and the session re-runs on app resume.
 */
export interface CaptureService {
  /** Build the lifecycle for one graph session. `dispose()` is terminal. */
  openSession(options: CaptureSessionOptions): CaptureSession
  /** Fires after a pass may have written X post archives, even when it stopped partway. */
  onXPostsWritten(listener: () => void): Unlisten
}

export function createCaptureService(deps: {
  captureInbox: CaptureInboxService
  noteFile: Pick<NoteFileService, 'read' | 'write' | 'listNotes'>
  assetStore: Pick<AssetStoreService, 'readBase64' | 'writeBase64'>
  openDocuments: Pick<OpenDocumentsService, 'sessionFor'>
  backlinkTarget: BacklinkTargetService
  xArchive: Pick<XArchiveService, 'write'>
  webFetch: Pick<WebFetchService, 'fetchMeta' | 'fetchOembed' | 'fetchLinkPreviewImage'>
  pageDescriber: PageDescriberService
  aiProviderConfig: Pick<AiProviderConfigService, 'defaultProvider'>
  aiCredentials: Pick<AiCredentialService, 'read'>
  privacy: Pick<PrivacyService, 'cloudSafeLinkHref'>
  hash: HashService
  clock: Pick<ClockService, 'now'>
  reconcilers: BackgroundReconcilerFactory
  lifecycle: Pick<AppLifecycleService, 'subscribeVisible'>
  fileChanges: Pick<FileChangeService, 'subscribe'>
  operations: Pick<OperationsService, 'start'>
  platform: Pick<PlatformFacts, 'appPlatform' | 'surface'>
  logger: Pick<LoggerService, 'error' | 'warn'>
}): CaptureService {
  const {
    captureInbox,
    noteFile,
    assetStore,
    openDocuments,
    backlinkTarget,
    xArchive,
    webFetch,
    pageDescriber,
    aiProviderConfig,
    aiCredentials,
    privacy,
    hash,
    clock,
    reconcilers,
    lifecycle,
    fileChanges,
    operations,
    platform,
    logger,
  } = deps

  const drainService = createCaptureDrainService({
    captureInbox,
    noteFile,
    xArchive,
    backlinkTarget,
    hash,
    clock,
    logger,
  })
  const enrichment = createCaptureEnrichmentService({
    noteFile,
    assetStore,
    webFetch,
    pageMeta: createPageMetaService({ webFetch }),
    pageDescriber,
    aiProviderConfig,
    aiCredentials,
    privacy,
    hash,
  })
  const xPostListeners = new Set<() => void>()

  /** Route an X post through the live daily document, or a revision-checked file write. */
  async function commitXPost(
    envelope: XPostEnvelope,
    path: string,
    generation: number,
  ): Promise<void> {
    const owner = openDocuments.sessionFor(path)
    if (owner !== null) {
      if (!(await owner.commitSourceEdit((source) => appendXPost(source, envelope)))) {
        throw new Error('Resolve or finish loading the daily note before saving X posts')
      }
      return
    }
    let source: string | null
    try {
      source = await noteFile.read(path, generation)
    } catch (cause) {
      if (!isAppError(cause) || cause.kind !== 'notFound') throw cause
      source = null
    }
    // A document may have opened while the filesystem read was pending.
    const opened = openDocuments.sessionFor(path)
    if (opened !== null) {
      if (!(await opened.commitSourceEdit((current) => appendXPost(current, envelope)))) {
        throw new Error('The daily note is busy; X post remains queued')
      }
      return
    }
    const next = appendXPost(source ?? '', envelope)
    if (next !== source) await noteFile.write(path, next, generation, source)
  }

  function openSession(options: CaptureSessionOptions): CaptureSession {
    const { generation } = options
    // The mobile shell has no file watcher, so returning to the app is the
    // arrival signal for captures shared while it was backgrounded.
    const mobile = isMobilePlatform(platform.appPlatform) || platform.surface.mobileApp

    /**
     * Last surfaced stop message per phase label — retries must not re-toast
     * it. Keyed by label so one phase succeeding (which clears its own entry)
     * cannot make another phase's persistent failure re-toast every pass.
     */
    const surfacedStops = new Map<string, string>()

    function surfaceStop(label: string, stopped: ReconcileStop | null): void {
      if (stopped === null) {
        surfacedStops.delete(label)
        return
      }
      // Self-healing stops (network/config/stale) stay silent: offline retries on
      // the next trigger, config means no provider/key (enrichment waits; the raw
      // save is done), stale is a graph switch tearing the pass down.
      if (isSilentStop(stopped) || surfacedStops.get(label) === stopped.message) {
        return
      }
      surfacedStops.set(label, stopped.message)
      operations.start(label).fail(stopped.message)
    }

    /** One pass: drain the spool inbox (no AI needed), then enrich pending captures. */
    const reconcile = async (isStale: () => boolean): Promise<void> => {
      if (mobile) {
        let relayStop: ReconcileStop | null = null
        try {
          // Move envelopes the iOS share extension spooled into the App Group
          // inbox into the graph's capture inbox, ahead of every drain.
          await captureInbox.relaySharedInbox(generation)
        } catch (cause) {
          // Already-relayed envelopes must still drain, so a relay failure
          // surfaces like a drain stop instead of aborting the pass.
          relayStop = { reason: toAppError(cause).kind, message: errorMessage(cause) }
        }
        surfaceStop('Saving shared capture', relayStop)
        if (isStale()) {
          return
        }
      }
      const drained = await drainService.drain({
        generation,
        isStale,
        writeXPost: (envelope, path) => commitXPost(envelope, path, generation),
      })
      // A bookmark pass may have written X post archives, even when it stopped partway.
      if (drained.drained > 0 || drained.stopped !== null) {
        for (const listener of xPostListeners) {
          listener()
        }
      }
      surfaceStop('Saving link capture', drained.stopped)
      if (isStale()) {
        return
      }
      // The provider entry and its key are read at the start of every
      // enrichment pass — a key added in Settings mid-session must be seen by
      // the very next pass.
      const enriched = await enrichment.reconcile({ generation, isStale })
      surfaceStop('Enriching link capture', enriched.stopped)
    }

    const loop = reconcilers.create({ pass: reconcile })

    function launch(): void {
      if (loop.isStale()) {
        return
      }
      loop.schedule() // the launch pass: captures spooled while the app was closed
      loop.retryOnWake() // the network's natural retry signals (enrichment)
      if (mobile) {
        // Mobile resume: `focus` alone is unreliable in the iOS webview (the
        // iCloud refresh hook listens to both for the same reason).
        loop.onDispose(lifecycle.subscribeVisible(loop.schedule))
      }
      loop.onDispose(
        fileChanges.subscribe(({ changes }) => {
          const hasNewCapture = changes.some(
            (change) => change.kind === 'upsert' && isCaptureSpoolPath(change.path),
          )
          if (hasNewCapture) {
            loop.schedule()
          }
        }),
      )
    }

    function start(): void {
      // Registration (the pointer-file rewrite) completes BEFORE the first
      // drain: on a graph switch this repoints the host at the new graph as
      // early as possible, instead of draining here while the pointer still
      // names the old one. (The host reads the pointer per capture in its own
      // process, so a capture racing the rewrite can still spool to the
      // previous graph's inbox — it drains when that graph next opens.)
      // Best-effort: a failed registration must not block the drain — captures
      // already spooled must land regardless, and the extension surfaces
      // "host not found" with install guidance on its side. Mobile has no host
      // process at all: the share extension finds the App Group inbox itself.
      const registered = mobile
        ? Promise.resolve()
        : captureInbox.registerHost().catch((cause: unknown) => {
            logger.error('capture host registration failed:', cause)
          })
      void registered.then(() => {
        launch() // a no-op if the session was disposed while registering
      })
    }

    return { start, schedule: loop.schedule, dispose: loop.dispose }
  }

  return {
    openSession,
    onXPostsWritten(listener) {
      const deliver = (): void => {
        listener()
      }
      xPostListeners.add(deliver)
      return () => {
        xPostListeners.delete(deliver)
      }
    },
  }
}
