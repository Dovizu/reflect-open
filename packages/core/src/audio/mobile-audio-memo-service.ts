import { AUDIO_MEMO_REMINDER_MS, AUDIO_MEMO_SEGMENT_MS } from './audio-memo-session.ts'
import { audioMemoIdentity, audioMemoPartPath } from './audio-memo.ts'
import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { PlatformFacts } from '../app/platform-service.ts'
import { errorMessage } from '../errors.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { HapticsService } from '../ipc/mobile-haptics-plugin.ts'
import type { AudioMemoPhase, AudioMemoService } from './audio-memo-service.ts'
import type {
  AudioRecorderSegment,
  AudioRecorderService,
  AudioRecorderState,
} from './audio-recorder-service.ts'
import { NATIVE_RECORDING_MIME } from './native-audio-recorder.ts'
import type { NativeActionService } from './native-action-service.ts'

const MIC_DENIED_REASON = 'Microphone access was denied. Allow it for Reflect in the Settings app.'

/** What a {@link MobileAudioMemoSession} shows of itself. */
export interface MobileAudioMemoSessionState {
  readonly phase: AudioMemoPhase
  /** Live while recording. */
  readonly elapsedMs: number
  /** Latest input level 0…1, for the waveform. */
  readonly level: number
  /** Recordings committed but not yet written to the graph. */
  readonly pendingCount: number
  /** False without the native shell (the recorder is a native plugin). */
  readonly available: boolean
  /** False when no OpenAI/Gemini model is configured; the drawer then guides key setup. */
  readonly hasTranscriptionConfig: boolean
  /** The failure shown in the error phase. */
  readonly error: string | null
  /** True when a retry can re-run the failed capture. */
  readonly canRetry: boolean
  /** The recording drawer's visibility. */
  readonly drawerOpen: boolean
}

/**
 * The mobile audio-memo surface for one graph session: the native recorder
 * plugin over the shared capture pipeline (`AudioMemoService.openPipeline` —
 * the same serial queue and transcription lifecycle desktop uses). Desktop
 * presents recording in a sidebar popover; here it is a bottom drawer plus
 * the mic action in the Daily capture menu.
 *
 * Mobile-only responsibilities:
 *
 * - **Segments and native stops.** The recorder rotates itself every
 *   `AUDIO_MEMO_SEGMENT_MS`, announcing each finished segment; interruptions
 *   (calls, Siri) and input-route loss end the session natively. Both are
 *   ingested exactly like a user stop. A session has no duration limit, and
 *   backgrounding is deliberately not a stop: `UIBackgroundModes: audio`
 *   keeps a memo capturing through screen lock (V1 parity).
 * - **The orphan scan**: staged segments no live flow owns — from a crash, a
 *   webview reload, or a kill while backgrounded — are handed to the capture
 *   pipeline when the session opens and on every foreground, oldest session
 *   first. Finished segments of the session recording *right now* are picked
 *   up too: they are complete files (the listing excludes the one still
 *   being written), and landing them early is the point. Ingest is
 *   idempotent by session and position, so a file whose delete failed
 *   re-resolves to the same segment on the next scan instead of duplicating.
 * - **The live-recording reconcile + native-action handshake**
 *   (`NativeActionService`): a recording that outlived its JS is stopped and
 *   saved rather than left a hidden hot microphone, and OS entry points'
 *   queued `recordAudio` requests are claimed and confirmed.
 */
export interface MobileAudioMemoSession {
  /** The current state. The same object until something changes. */
  getState: () => MobileAudioMemoSessionState
  subscribe: (listener: () => void) => Unlisten
  /** Audio action tap: idle → record (or key setup); recording → stop & save; error → show it. */
  toggle(): void
  /** The drawer's stop control — commit the memo. */
  stopAndSave(): void
  /** The drawer's discard control — drop the live recording. */
  cancelRecording(): void
  /** Drawer dismissal: a live recording stops-and-saves, never silently drops. */
  setDrawerOpen(open: boolean): void
  /** Re-run the failed capture. */
  retry(): void
  /** Drop the failed memo and let the queue continue. */
  discard(): void
  /** Detach from the recorder and stop the transcription lifecycle. A live recording keeps running. */
  dispose(): void
}

/** Native recording sessions end to end: start, stop-and-save, discard, and exactly-once ingest. */
export interface MobileAudioMemoService {
  /** Open the mobile recording surface of the open graph's session; throws when no graph is open. */
  openSession(): MobileAudioMemoSession
}

/** One finished segment of a recording session, staged and ready to ingest. */
interface StagedPart {
  /** The staged file's absolute path; deleted once the graph write lands. */
  stagedPath: string
  /**
   * The session's start time, used as the memo's identity timestamp. Every
   * segment of one session shares it, and it is encoded in the staged
   * filename — so the live flow and the orphan scan file the same segment
   * under the same memo basename.
   */
  recordedAt: Date
  /** 1-based position within the session. */
  part: number
  /** True on the session's final segment (its file carries `-end`). */
  end: boolean
}

/**
 * The live recording session. The graph is its ledger, so this only carries
 * identity: unlike desktop, a session here can outlive the webview that
 * started it, and an in-memory list of captured paths would miss whatever a
 * previous webview ingested for the same recording.
 */
interface LiveSession {
  /** Identity derives from the session's start: every segment shares it. */
  recordedAt: Date
  cancelled: boolean
}

function toStagedPart(segment: AudioRecorderSegment): StagedPart {
  if (segment.audio.kind !== 'staged') {
    throw new Error('the native audio recorder produced an unstaged segment')
  }
  return {
    stagedPath: segment.audio.path,
    recordedAt: new Date(segment.sessionStartedMs),
    part: segment.part,
    end: segment.end,
  }
}

/** True when the native recorder rejected `start` because access was denied. */
function isMicDeniedError(cause: unknown): boolean {
  return errorMessage(cause).includes('denied')
}

export function createMobileAudioMemoService(deps: {
  audioMemo: Pick<AudioMemoService, 'openPipeline'>
  audioRecorder: AudioRecorderService
  nativeAction: NativeActionService
  lifecycle: Pick<AppLifecycleService, 'subscribeVisible'>
  haptics: Pick<HapticsService, 'impactLight'>
  platform: Pick<PlatformFacts, 'isNativeShell'>
  logger: Pick<LoggerService, 'error' | 'warn'>
}): MobileAudioMemoService {
  const { audioMemo, audioRecorder, nativeAction, lifecycle, haptics, platform, logger } = deps

  function hapticImpactLight(): void {
    void haptics.impactLight().catch(() => {})
  }

  function openSession(): MobileAudioMemoSession {
    const listeners = new Set<() => void>()
    let drawerOpen = false
    /** True from the stop tap until the recorder hands over the file. */
    let stopping = false
    let elapsedMs = 0
    let level = 0
    let live: LiveSession | null = null
    /**
     * Sessions the user discarded, by identity timestamp. A native discard that
     * fails to delete a staged segment leaves it for the orphan scan, which
     * would otherwise resurrect a memo the user threw away on the next
     * foreground.
     */
    const cancelledSessions = new Set<number>()
    /** Re-entry guard for the stop tap's await gap. */
    let stopGuard = false
    /** One orphan scan at a time. */
    let scanning = false
    let disposed = false

    // The pump consults the drawer the instant a capture fails.
    const pipeline = audioMemo.openPipeline({
      isErrorSurfaceVisible: () => drawerOpen,
    })
    const available = platform.isNativeShell

    const snapshot = (): MobileAudioMemoSessionState => {
      const recorderState: AudioRecorderState = audioRecorder.state()
      const pipelineState = pipeline.getState()
      return {
        // A live capture owns the surface — a background save's failure parks and
        // shows after the stop, never yanking the waveform mid-recording.
        phase:
          recorderState === 'recording' && !stopping
            ? 'recording'
            : recorderState === 'requesting'
              ? 'requesting'
              : pipelineState.error !== null
                ? 'error'
                : stopping || pipelineState.pendingCount > 0 || pipelineState.transcribing
                  ? 'transcribing'
                  : 'idle',
        elapsedMs,
        level,
        pendingCount: pipelineState.pendingCount,
        available,
        hasTranscriptionConfig: pipelineState.hasTranscriptionConfig,
        error: pipelineState.error,
        canRetry: pipelineState.canRetry,
        drawerOpen,
      }
    }
    let state = snapshot()

    function publish(): void {
      const next = snapshot()
      if (
        next.phase === state.phase &&
        next.elapsedMs === state.elapsedMs &&
        next.level === state.level &&
        next.pendingCount === state.pendingCount &&
        next.hasTranscriptionConfig === state.hasTranscriptionConfig &&
        next.error === state.error &&
        next.canRetry === state.canRetry &&
        next.drawerOpen === state.drawerOpen
      ) {
        return
      }
      state = next
      for (const listener of listeners) {
        listener()
      }
    }

    function setDrawerOpen(open: boolean): void {
      drawerOpen = open
      publish()
    }

    function setStopping(next: boolean): void {
      stopping = next
      publish()
    }

    /** Wrap a staged segment as a pipeline capture that owns the file. */
    function enqueuePart(part: StagedPart): void {
      const release = async (): Promise<void> => {
        // Always drop the claim, even if the delete fails: a still-claimed
        // path is skipped forever by the orphan scan, so a discarded memo
        // whose delete threw would otherwise reappear on the next launch.
        try {
          await audioRecorder.deleteStaged(part.stagedPath)
        } finally {
          audioRecorder.releaseStaged(part.stagedPath)
        }
      }
      if (cancelledSessions.has(part.recordedAt.getTime())) {
        void release()
        return
      }
      const memo = audioMemoIdentity(part.recordedAt, NATIVE_RECORDING_MIME)
      const path = audioMemoPartPath(memo, part.part, part.end)
      // Only the live session's segments answer to its cancel: a segment the
      // orphan scan found from an earlier run must not be swept away by
      // discarding the recording running now.
      const session = live
      const owner =
        session !== null && session.recordedAt.getTime() === part.recordedAt.getTime()
          ? session
          : null
      pipeline.enqueue({
        audio: { kind: 'staged', path: part.stagedPath },
        mimeType: NATIVE_RECORDING_MIME,
        recordedAt: part.recordedAt,
        segment: { part: part.part, end: part.end },
        onCaptured: async () => {
          // A cancel that swept the directory before this segment's copy
          // landed has to be honored here instead.
          if (owner?.cancelled === true) {
            await pipeline.deleteSegment(path).catch(() => {})
          }
          await release()
        },
        onDiscarded: release,
      })
    }

    async function start(): Promise<void> {
      if (!available) {
        return
      }
      setDrawerOpen(true)
      // Recording never starts without a transcription key: the drawer opens on
      // its key-setup guidance instead. OS entry points (Siri, the widget, the
      // quick action) funnel through here too, so they surface the same guidance.
      if (!pipeline.getState().hasTranscriptionConfig) {
        return
      }
      try {
        const session = await audioRecorder.start({
          segmentMs: AUDIO_MEMO_SEGMENT_MS,
          reminderMs: AUDIO_MEMO_REMINDER_MS,
        })
        if (session !== null) {
          live = { recordedAt: new Date(session.sessionStartedMs), cancelled: false }
        }
        hapticImpactLight()
      } catch (cause) {
        pipeline.reportError(isMicDeniedError(cause) ? MIC_DENIED_REASON : errorMessage(cause))
      }
    }

    /** Stop and hand back the final segment — `null` for a session too short to keep. */
    async function stopRecorder(): Promise<StagedPart | null> {
      // A stop in flight keeps the state at `recording` until it settles, and
      // the recorder hands every concurrent caller the same result.
      if (audioRecorder.state() !== 'recording') {
        return null
      }
      const final = await audioRecorder.stop()
      return final === null ? null : toStagedPart(final)
    }

    async function stopAndSave(): Promise<void> {
      if (stopGuard) {
        return
      }
      stopGuard = true
      // The stop tap commits the memo: the drawer closes now, and the capture
      // menu's mic action reflects the 'transcribing' state when reopened.
      setStopping(true)
      setDrawerOpen(false)
      try {
        const part = await stopRecorder()
        if (part !== null) {
          enqueuePart(part)
        }
        live = null
        hapticImpactLight()
      } catch (cause) {
        // A native stop (interruption, backgrounding) won the race — its
        // stopped event delivers the memo instead.
        logger.warn('stop raced a native finalize:', cause)
      } finally {
        stopGuard = false
        setStopping(false)
      }
    }

    function cancelRecording(): void {
      setDrawerOpen(false)
      const session = live
      if (session !== null) {
        // Discard means discard: every segment already in the graph goes too.
        // What is on disk is the only complete account of what this session
        // wrote, and the flag catches the segments still being copied.
        session.cancelled = true
        cancelledSessions.add(session.recordedAt.getTime())
        const memo = audioMemoIdentity(session.recordedAt, NATIVE_RECORDING_MIME)
        void (async () => {
          for (const path of await pipeline.listSegments(memo)) {
            await pipeline.deleteSegment(path).catch(() => {})
          }
        })().catch((cause: unknown) => {
          logger.error('discarding the recorded segments failed:', cause)
        })
      }
      void audioRecorder
        .cancel()
        .catch((cause: unknown) => {
          logger.warn('cancel raced a native finalize:', cause)
        })
        .finally(() => {
          if (live === session) {
            live = null
          }
        })
    }

    /** Hand unclaimed staged segments to the capture pipeline. */
    async function scan(): Promise<void> {
      if (scanning) {
        return
      }
      scanning = true
      try {
        const files = await audioRecorder.listStaged()
        for (const file of files) {
          if (disposed) {
            return
          }
          if (audioRecorder.isStagedClaimed(file.path)) {
            continue
          }
          audioRecorder.claimStaged(file.path)
          enqueuePart({
            stagedPath: file.path,
            recordedAt: new Date(file.sessionStartedMs),
            part: file.part,
            end: file.end,
          })
        }
      } catch (cause) {
        logger.error('audio memo orphan scan failed:', cause)
      } finally {
        scanning = false
      }
    }

    const unlisten: Unlisten[] = [
      pipeline.subscribe(publish),
      audioRecorder.subscribeState((next) => {
        if (next !== 'recording') {
          elapsedMs = 0
          level = 0
        }
        publish()
      }),
      audioRecorder.subscribeLevel((event) => {
        level = event.level
        elapsedMs = event.elapsedMs
        publish()
      }),
      // A segment the recorder rotated away from; the session keeps recording.
      audioRecorder.subscribeSegment((segment) => {
        enqueuePart(toStagedPart(segment))
      }),
      // A stop the native side initiated (interruption, route change): the file
      // is already staged and end-marked — treated exactly like a user stop.
      audioRecorder.subscribeStopped((stopped) => {
        setDrawerOpen(false)
        setStopping(false)
        if (stopped.segment !== null) {
          enqueuePart(toStagedPart(stopped.segment))
        }
        live = null
      }),
      nativeAction.open({
        start,
        onReconciledSegment: (segment) => {
          enqueuePart(toStagedPart(segment))
        },
      }),
    ]
    if (platform.isNativeShell) {
      void scan()
      unlisten.push(lifecycle.subscribeVisible(() => void scan()))
    }

    return {
      getState: () => state,
      subscribe(listener) {
        const entry = (): void => {
          listener()
        }
        listeners.add(entry)
        return () => {
          listeners.delete(entry)
        }
      },
      toggle() {
        const recorderState = audioRecorder.state()
        if (recorderState === 'recording') {
          void stopAndSave()
        } else if (recorderState === 'requesting') {
          void audioRecorder.cancel().catch(() => {})
          setDrawerOpen(false)
        } else if (pipeline.getState().error !== null) {
          // A parked error must never invisibly block recording — the audio
          // action reopens the drawer, which shows the failure with Retry/Discard.
          setDrawerOpen(true)
        } else {
          void start()
        }
      },
      stopAndSave() {
        void stopAndSave()
      },
      cancelRecording,
      setDrawerOpen(open) {
        if (open) {
          setDrawerOpen(true)
          return
        }
        // Dismissing the drawer mid-recording saves — a swipe-down must never
        // silently drop audio (discarding is the explicit Cancel control).
        const recorderState = audioRecorder.state()
        if (recorderState === 'recording') {
          void stopAndSave()
        } else if (recorderState === 'requesting') {
          void audioRecorder.cancel().catch(() => {})
        }
        setDrawerOpen(false)
      },
      retry() {
        pipeline.retry()
      },
      discard() {
        pipeline.discard()
      },
      dispose() {
        disposed = true
        for (const stop of unlisten) {
          stop()
        }
        pipeline.dispose()
      },
    }
  }

  return { openSession }
}
