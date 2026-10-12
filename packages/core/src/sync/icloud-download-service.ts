import type { ClockService, TimerHandle } from '../app/clock-service.ts'
import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import { errorMessage } from '../errors.ts'
import type { ICloudNativeService } from '../ipc/icloud-native-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'

/**
 * A resume transition fires `visibilitychange` and `focus` together in
 * WKWebView (same window as the backup service's resume triggers);
 * triggers inside this window collapse into one refresh.
 */
const RESUME_REFRESH_DEDUPE_MS = 1500

/**
 * While placeholders are still pending, poll the count and reconcile the
 * moment it reaches zero — note files are small, so downloads usually land
 * within a poll or two and the Mac edit appears in seconds. Each poll is a
 * full-graph walk in Rust, so the wait doubles from this floor up to
 * {@link PENDING_POLL_MAX_MS}: the fast early ticks stay, and a slow link
 * stops paying a walk every second for the whole drain.
 */
const PENDING_POLL_MS = 1000

/** The backoff ceiling between pending-count polls. */
const PENDING_POLL_MAX_MS = 4000

/** Give up polling after this long; the metadata watch and the next resume
 * still cover stragglers (a large asset on a slow link, say). */
const PENDING_POLL_LIMIT_MS = 20_000

/** The open iCloud graph one {@link ICloudDownloadService} keeps fresh. */
export interface ICloudDownloadServiceOptions {
  /** The open graph's root. */
  root: string
  /** Run the ordinary full index refresh (`GraphSessionService.refreshIndex`). */
  refreshIndex: () => void
}

/** The services an {@link ICloudDownloadService} runs on. */
export interface ICloudDownloadServiceDeps {
  icloudNative: Pick<ICloudNativeService, 'downloadPending' | 'pendingCount'>
  lifecycle: Pick<AppLifecycleService, 'isHidden' | 'subscribeFocus' | 'subscribeVisible'>
  clock: ClockService
  logger: LoggerService
}

/**
 * Keeps an iCloud-stored graph fresh while the mobile app is used (Plan 21).
 *
 * Mobile has no file watcher — local writes notify in-process, and for git
 * graphs remote changes only arrive through pull. iCloud is different: the
 * OS lands files in the container behind the app's back, and on iOS it
 * doesn't even download them until asked. The metadata-query watch nudges
 * downloads live while the app is open; this service covers the resume seams
 * the query can miss: on every resume it nudges the pending downloads and
 * re-runs the index reconcile, and while placeholders remain it polls the
 * pending *count* (never re-requesting), reconciling the moment downloads
 * land instead of waiting for the next resume.
 *
 * The on-open trigger only nudges: the open itself just synced the index
 * against local disk, so an immediate second full pass would repeat that
 * work — on a first sync of a large graph, at the worst possible moment.
 *
 * Downloads are sequenced notes-first: the nudge and the poll cover only
 * markdown under the note directories, and the full-scope request (assets,
 * recordings) fires once the note count drains — so a first sync's bulk
 * bytes never compete with the first index pass.
 */
export interface ICloudDownloadService {
  /** Nudge the pending note downloads once and start following resumes. */
  start: () => void
  /** Stop polling and listening; the service is unusable afterwards. */
  dispose: () => void
}

/** Builds the {@link ICloudDownloadService} of one open iCloud graph. */
export interface ICloudDownloadServiceFactory {
  create(options: ICloudDownloadServiceOptions): ICloudDownloadService
}

export function createICloudDownloadServiceFactory(
  deps: ICloudDownloadServiceDeps,
): ICloudDownloadServiceFactory {
  return { create: (options) => createICloudDownloadService(deps, options) }
}

export function createICloudDownloadService(
  deps: ICloudDownloadServiceDeps,
  options: ICloudDownloadServiceOptions,
): ICloudDownloadService {
  const { icloudNative, lifecycle, clock, logger } = deps
  const { root, refreshIndex } = options
  let disposed = false
  let lastRefreshAt = 0
  let retryTimer: TimerHandle | null = null
  const disposers: Unlisten[] = []

  // Notes download first; everything else (assets are most of the bytes)
  // is requested only once the note placeholders drain. Kicking thousands
  // of concurrent downloads at open put the whole first sync — network,
  // disk, file coordination — under the first index pass, and the app
  // crawled until it finished. Fire-and-forget: nothing polls or
  // reconciles for assets (they aren't indexed; images appear as they
  // land), and a failed request is retried by the next resume's drain.
  const requestRemainingDownloads = (): void => {
    void icloudNative.downloadPending(root, 'all').catch((err: unknown) => {
      logger.error('iCloud asset download request failed:', errorMessage(err))
    })
  }

  const pollPending = (startedAt: number, attempt: number): void => {
    if (retryTimer !== null) {
      return
    }
    const delayMs = Math.min(PENDING_POLL_MS * 2 ** attempt, PENDING_POLL_MAX_MS)
    retryTimer = clock.setTimeout(() => {
      retryTimer = null
      if (disposed) {
        return
      }
      if (lifecycle.isHidden()) {
        // Backgrounded mid-drain: stop rather than keep walking the graph
        // behind a hidden webview (every sibling service suspends on
        // hidden). The next resume restarts the whole sequence — clear the
        // dedupe stamp so even a resume inside the dedupe window counts
        // (otherwise a quick hide → show would leave nothing scheduled).
        lastRefreshAt = 0
        return
      }
      void icloudNative.pendingCount(root, 'notes').then(
        (pending) => {
          if (disposed) {
            return
          }
          if (pending === 0) {
            // The notes landed — one reconcile picks the batch up
            // together, and the deferred bulk (assets) may start.
            refreshIndex()
            requestRemainingDownloads()
            return
          }
          if (clock.now() - startedAt >= PENDING_POLL_LIMIT_MS) {
            // Done waiting (a slow link): index what landed. The asset
            // request stays deferred — it would compete with the notes
            // still downloading; the next resume retries the sequence.
            refreshIndex()
            return
          }
          pollPending(startedAt, attempt + 1)
        },
        (err: unknown) => {
          logger.error('iCloud pending poll failed:', errorMessage(err))
          if (!disposed) {
            refreshIndex()
          }
        },
      )
    }, delayMs)
  }

  const refresh = async (refreshOptions: { reconcile: boolean }): Promise<void> => {
    let pending = 0
    let nudged = false
    try {
      pending = await icloudNative.downloadPending(root, 'notes')
      nudged = true
    } catch (err) {
      // Best-effort: reconcile anyway — already-downloaded changes still land.
      logger.error('iCloud download nudge failed:', errorMessage(err))
    }
    if (disposed) {
      return
    }
    if (refreshOptions.reconcile) {
      refreshIndex()
    }
    if (pending > 0) {
      pollPending(clock.now(), 0)
    } else if (nudged) {
      // A confirmed-empty note count — never a failed nudge, which would
      // start the bulk while notes may still be pending. The next resume
      // retries the whole sequence.
      requestRemainingDownloads()
    }
  }

  const onResume = (): void => {
    const now = clock.now()
    if (now - lastRefreshAt < RESUME_REFRESH_DEDUPE_MS) {
      return
    }
    lastRefreshAt = now
    void refresh({ reconcile: true })
  }

  return {
    start() {
      if (disposed) {
        return
      }
      // Once on open: the reconcile that ran at open indexed what was already
      // local, so this pass only asks iCloud for the rest — the poll (or the
      // live watch) reconciles once something actually lands.
      lastRefreshAt = clock.now()
      void refresh({ reconcile: false })
      disposers.push(lifecycle.subscribeFocus(onResume), lifecycle.subscribeVisible(onResume))
    },
    dispose() {
      disposed = true
      if (retryTimer !== null) {
        clock.clearTimeout(retryTimer)
      }
      for (const disposeOne of disposers.splice(0)) {
        disposeOne()
      }
    },
  }
}
