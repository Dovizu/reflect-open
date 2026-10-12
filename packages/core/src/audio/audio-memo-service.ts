import {
  AUDIO_MEMO_REMINDER_MS,
  AUDIO_MEMO_SEGMENT_MS,
  type AudioMemoIdentity,
} from './audio-memo-session.ts'
import { audioMemoIdentity, audioMemoPartFromPath, audioMemoPartPath } from './audio-memo.ts'
import type { AiCredentialService } from '../ai/ai-credential-service.ts'
import type { AiProviderConfigService } from '../ai/ai-provider-config-service.ts'
import type { TranscriptEnrichmentService } from '../ai/transcript-enrichment-service.ts'
import type { TranscriptionService } from '../ai/transcription-service.ts'
import type { BackgroundReconcilerFactory } from '../app/background-reconciler.ts'
import type { ClockService } from '../app/clock-service.ts'
import type { AppLifecycleService } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { PlatformFacts } from '../app/platform-service.ts'
import type { WindowService } from '../app/window-service.ts'
import type { BacklinkTargetService } from '../capture/backlink-target-service.ts'
import { errorMessage } from '../errors.ts'
import type { AssetStoreService } from '../graph/asset-store-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import { AUDIO_MEMOS_DIR } from '../graph/paths.ts'
import type { FileChangeService } from '../indexing/file-change-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import {
  createAudioMemoTranscriptionService,
  type AudioMemoTranscriptionSession,
} from './audio-memo-transcription-service.ts'
import type {
  AudioRecorderSegment,
  AudioRecorderService,
  AudioRecorderState,
  RecordedAudio,
} from './audio-recorder-service.ts'

export interface CaptureAudioMemoPartInput {
  /** One finished segment, as the recorder produced it. */
  audio: RecordedAudio
  /** The segment's MIME type, possibly with codec parameters. */
  mimeType: string
  /** When the *session* started — every part shares the session identity. */
  recordedAt: Date
  /** 1-based position within the session. */
  part: number
  /** True on the session's final segment. */
  end: boolean
  /** `GraphInfo.generation` — pins the write to the issuing graph. */
  generation: number
}

/** Expected failures are data: the caller retries with the same recording. */
export type CaptureAudioMemoOutcome =
  | { ok: true; memo: AudioMemoIdentity }
  | { ok: false; message: string }

/** A stopped recording waiting its turn through the capture queue. */
export interface PendingAudioCapture {
  audio: RecordedAudio
  mimeType: string
  recordedAt: Date
  /** Placement within the recording session this segment belongs to. */
  segment: { part: number; end: boolean }
  /**
   * Runs after the recording's bytes are durably in the graph — mobile
   * deletes its native staged file here. A failure is logged, never parked:
   * the audio is already safe, and the worst case (the staged copy
   * lingering) re-ingests idempotently by its stop time.
   */
  onCaptured?: () => Promise<void> | void
  /** Runs when the user discards this capture after it failed to write. */
  onDiscarded?: () => Promise<void> | void
}

/** What an {@link AudioMemoPipeline} shows of itself. */
export interface AudioMemoPipelineState {
  /** Recordings committed but not yet written to the graph. */
  readonly pendingCount: number
  /** True while a reconcile pass has memos to transcribe. */
  readonly transcribing: boolean
  /** False when no OpenAI/Gemini model is configured. */
  readonly hasTranscriptionConfig: boolean
  /** The failure shown in the error phase. */
  readonly error: string | null
  /** True when a retry can re-run a failed capture. */
  readonly canRetry: boolean
}

export interface AudioMemoPipelineOptions {
  /** The open graph's generation — pins captures and transcription to it. */
  generation: number
  /**
   * Whether the capture-error UI (popover, drawer) is on screen. When it is
   * not, a failed capture is also surfaced as a failed operation so the
   * error can never park the queue invisibly.
   */
  isErrorSurfaceVisible: () => boolean
}

/**
 * The platform-neutral half of the audio-memo surface for one graph session:
 * the serial capture queue and the transcription lifecycle. The desktop
 * session ({@link AudioMemoSession}, webview MediaRecorder) and the mobile
 * session (`MobileAudioMemoService`, the native recorder plugin) both drain
 * their recordings through one; what differs — how audio is recorded and how
 * the recording UI looks — stays in each session.
 *
 * The pipeline is raw-first: a queued recording is written into the graph's
 * `audio-memos/` — local, instant — and transcription belongs to the
 * lifecycle this mounts, which owns every trigger and retry rule. Captures
 * drain through a serial queue so memos can be recorded back-to-back; a
 * failed *capture* (the one step that can lose audio) parks the queue behind
 * a Retry/Discard error.
 */
export interface AudioMemoPipeline {
  /** The current state. The same object until something changes. */
  getState(): AudioMemoPipelineState
  subscribe(listener: () => void): Unlisten
  /** Queue a stopped recording for capture into the graph. */
  enqueue(capture: PendingAudioCapture): void
  /** Surface a recorder failure (mic denied, hardware) in the error state. */
  reportError(message: string): void
  /** Re-run the failed capture. */
  retry(): void
  /** Drop the failed memo (or clear a recorder error) and continue. */
  discard(): void
  /** Stop the transcription lifecycle. Queued captures still drain. */
  dispose(): void
}

/**
 * 'transcribing' means committed memos are still being captured or
 * transcribed in the background — the mic stays available, so the next
 * recording can start immediately.
 */
export type AudioMemoPhase = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'error'

/** The recording UI of a desktop {@link AudioMemoSession}, as its host shows it. */
export interface AudioMemoSurface {
  /** Bring the hidden recording UI on screen (expand the collapsed sidebar). */
  reveal(): void
  /** Tell the user the session is still running; `stopAndSave` ends it. */
  showReminder(elapsedMs: number, stopAndSave: () => void): void
  dismissReminder(): void
}

export interface AudioMemoSessionOptions {
  /** The open graph's generation — pins captures and transcription to it. */
  generation: number
  surface: AudioMemoSurface
  /** Whether the recording UI is hidden when the session opens. */
  surfaceHidden: boolean
}

/** What a desktop {@link AudioMemoSession} shows of itself. */
export interface AudioMemoSessionState {
  readonly phase: AudioMemoPhase
  /** Live while recording. */
  readonly elapsedMs: number
  /** The live input stream, for the waveform. */
  readonly stream: MediaStream | null
  /** Recordings committed but not yet written to the graph. */
  readonly pendingCount: number
  /** False when no OpenAI/Gemini model is configured or the platform can't record. */
  readonly available: boolean
  /** Why the mic is disabled (tooltip copy), null when `available`. */
  readonly unavailableReason: string | null
  /** The failure shown in the error phase. */
  readonly error: string | null
  /** True when a retry can re-run the failed capture. */
  readonly canRetry: boolean
  /** The recorder behind the phase. */
  readonly recorderState: AudioRecorderState
}

/**
 * The desktop audio-memo surface for one graph session: the webview recorder
 * over an {@link AudioMemoPipeline}. The session lives above the recording UI
 * because the mic button unmounts with the sidebar, and a recording must
 * never outlive its UI invisibly: hiding the UI mid-recording stops and saves
 * instead of leaving a hidden hot microphone.
 */
export interface AudioMemoSession {
  /** The current state. The same object until something changes. */
  getState: () => AudioMemoSessionState
  subscribe: (listener: () => void) => Unlisten
  /** Idle → start recording (revealing a hidden UI); recording → stop & save. */
  toggle(): void
  /** Discard the in-flight recording without saving. */
  cancel(): void
  /** Re-run the failed capture. */
  retry(): void
  /** Drop the failed memo and let the queue continue. */
  discard(): void
  /**
   * The host rendered with the recording UI hidden or shown. While hidden, a
   * live recording stops and saves, and a pending permission request is
   * abandoned — a grant arriving after the UI went away would otherwise start
   * a recording with no UI mounted. The host calls this again whenever
   * {@link AudioMemoSessionState.recorderState} changes.
   */
  setSurfaceHidden(hidden: boolean): void
  /** Release the microphone and stop the transcription lifecycle. */
  dispose(): void
}

/**
 * Audio memos: segmented recordings saved raw under `audio-memos/`,
 * transcribed in the background with a BYOK model, and linked from the daily
 * note. See `AudioMemoTranscriptionService` for the transcription contract.
 */
export interface AudioMemoService {
  /**
   * Persist one session segment at its exact part path — the durable step, no
   * network. Rotation calls this as each segment finishes, so a crash loses at
   * most the segment still being recorded.
   */
  capturePart(input: CaptureAudioMemoPartInput): Promise<CaptureAudioMemoOutcome>
  /**
   * Graph paths of every segment of one session, in listing order. The cancel
   * sweep's account of what a session wrote: an in-memory ledger cannot see
   * segments a previous webview ingested for the same recording.
   */
  listSegments(memo: AudioMemoIdentity, generation: number): Promise<string[]>
  /** Delete one segment from the graph. Idempotent. */
  deleteSegment(path: string, generation: number): Promise<void>
  /**
   * Open the capture queue and, in the main window, the transcription
   * lifecycle of one graph session. Two lifecycles would double-transcribe
   * (and double-bill) the same memos, so a note window gets the queue only:
   * its saved memo is transcribed by the main window, which sees it arrive on
   * the watcher stream.
   */
  openPipeline(options: AudioMemoPipelineOptions): AudioMemoPipeline
  /** Open the desktop recording surface of one graph session. */
  openSession(options: AudioMemoSessionOptions): AudioMemoSession
}

const NO_PROVIDER_REASON = 'Add an OpenAI or Gemini model in Settings to record audio memos'
const UNSUPPORTED_REASON = 'Audio recording is not supported on this platform'

/** A live session's bookkeeping: identity once known, and cancel cleanup. */
interface LiveSession {
  recordedAt: Date
  memo: AudioMemoIdentity | null
  cancelled: boolean
  /** Segment paths already durably written, in case of a later cancel. */
  captured: string[]
}

export function createAudioMemoService(deps: {
  assetStore: Pick<
    AssetStoreService,
    | 'uploadToPath'
    | 'importAudioMemo'
    | 'deleteAudioMemo'
    | 'readBytes'
    | 'readTranscriptCache'
    | 'writeTranscriptCache'
  >
  noteFile: Pick<NoteFileService, 'read' | 'write' | 'listDir' | 'listNotes'>
  backlinkTarget: BacklinkTargetService
  transcription: TranscriptionService
  transcriptEnrichment: Pick<TranscriptEnrichmentService, 'enrich'>
  aiProviderConfig: Pick<
    AiProviderConfigService,
    'subscribe' | 'transcriptionConfig' | 'resolveTranscriptionTarget' | 'audioMemoEnrichmentConfig'
  >
  aiCredentials: Pick<AiCredentialService, 'read' | 'createPassReader'>
  audioRecorder: AudioRecorderService
  reconcilers: BackgroundReconcilerFactory
  lifecycle: Pick<AppLifecycleService, 'subscribeVisible'>
  fileChanges: Pick<FileChangeService, 'subscribe'>
  settings: Pick<SettingsService, 'get'>
  operations: Pick<OperationsService, 'start'>
  clock: Pick<ClockService, 'now'>
  platform: Pick<PlatformFacts, 'isMacosDesktop'>
  window: Pick<WindowService, 'isMainWindow'>
  logger: Pick<LoggerService, 'error'>
}): AudioMemoService {
  const {
    assetStore,
    noteFile,
    backlinkTarget,
    transcription,
    transcriptEnrichment,
    aiProviderConfig,
    aiCredentials,
    audioRecorder,
    reconcilers,
    lifecycle,
    fileChanges,
    settings,
    operations,
    clock,
    platform,
    window: windowService,
    logger,
  } = deps

  const transcriptions = createAudioMemoTranscriptionService({
    noteFile,
    assetStore,
    backlinkTarget,
    transcription,
    transcriptEnrichment,
    aiProviderConfig,
    aiCredentials,
    settings,
    reconcilers,
    lifecycle,
    fileChanges,
    operations,
    clock,
  })

  /** Persist one recording into the graph — the durable step, no network. */
  async function writeAudioMemoAsset(
    path: string,
    audio: RecordedAudio,
    generation: number,
  ): Promise<void> {
    if (audio.kind === 'staged') {
      // The recorder already wrote the file: Rust copies it in file-to-file, so
      // a meeting-length segment never enters webview memory.
      await assetStore.importAudioMemo(audio.path, path, generation)
      return
    }
    // Streamed where the transport carries binary bodies. Browser dev's
    // in-memory bridge has none; recordings there are short enough for the
    // base64 JSON route.
    await assetStore.uploadToPath(path, audio.blob, generation)
  }

  async function capturePart(input: CaptureAudioMemoPartInput): Promise<CaptureAudioMemoOutcome> {
    const memo = audioMemoIdentity(input.recordedAt, input.mimeType)
    try {
      await writeAudioMemoAsset(
        audioMemoPartPath(memo, input.part, input.end),
        input.audio,
        input.generation,
      )
    } catch (cause) {
      return { ok: false, message: errorMessage(cause) }
    }
    return { ok: true, memo }
  }

  async function deleteSegment(path: string, generation: number): Promise<void> {
    await assetStore.deleteAudioMemo(path, generation)
  }

  function openPipeline(options: AudioMemoPipelineOptions): AudioMemoPipeline {
    const { generation, isErrorSurfaceVisible } = options
    const listeners = new Set<() => void>()

    let pendingCount = 0
    let error: string | null = null
    /** Committed recordings waiting their turn; the pump owns the head. */
    const queue: PendingAudioCapture[] = []
    /** Single-drainer guard: one pump loop at a time, one capture at a time. */
    let pumping = false
    /**
     * The failed capture a retry should re-run. While parked, the queue holds —
     * memo order in the graph must survive the failure. Taken synchronously:
     * a rapid double Retry must see the first click's take, or two pipelines
     * write the recording twice.
     */
    let parked: PendingAudioCapture | null = null
    let hasTranscriptionConfig = aiProviderConfig.transcriptionConfig() !== null

    // One lifecycle per graph session. It owns the launch pass and all retry
    // triggers; the pump only schedules. Main window only.
    let reconciler: AudioMemoTranscriptionSession | null = windowService.isMainWindow()
      ? transcriptions.openSession({ generation })
      : null

    const snapshot = (): AudioMemoPipelineState => ({
      pendingCount,
      transcribing: reconciler?.getTranscribing() ?? false,
      hasTranscriptionConfig,
      error,
      canRetry: parked !== null,
    })
    let state = snapshot()

    function publish(): void {
      const next = snapshot()
      if (
        next.pendingCount === state.pendingCount &&
        next.transcribing === state.transcribing &&
        next.hasTranscriptionConfig === state.hasTranscriptionConfig &&
        next.error === state.error &&
        next.canRetry === state.canRetry
      ) {
        return
      }
      state = next
      for (const listener of listeners) {
        listener()
      }
    }

    const stopTranscribing = reconciler?.subscribe(publish)
    reconciler?.start()

    // Passes gate on a configured model before any IO — when the user adds the
    // first key mid-session, kick the pass that gate was suppressing.
    const stopConfig = aiProviderConfig.subscribe(() => {
      const hadConfig = hasTranscriptionConfig
      hasTranscriptionConfig = aiProviderConfig.transcriptionConfig() !== null
      if (hasTranscriptionConfig && !hadConfig) {
        reconciler?.schedule()
      }
      publish()
    })

    async function pump(): Promise<void> {
      if (pumping) {
        return
      }
      pumping = true
      let captured = false
      try {
        while (parked === null) {
          const capture = queue.shift()
          if (capture === undefined) {
            break
          }
          let outcome: CaptureAudioMemoOutcome
          try {
            outcome = await capturePart({
              audio: capture.audio,
              mimeType: capture.mimeType,
              recordedAt: capture.recordedAt,
              part: capture.segment.part,
              end: capture.segment.end,
              generation,
            })
          } catch (cause) {
            outcome = { ok: false, message: errorMessage(cause) }
          } finally {
            pendingCount -= 1
            publish()
          }
          if (outcome.ok) {
            captured = true
            try {
              await capture.onCaptured?.()
            } catch (cause) {
              // The audio is already durable in the graph — a cleanup failure
              // must not park the queue behind it.
              logger.error('audio memo post-capture cleanup failed:', cause)
            }
          } else {
            // Park the queue behind the failure: the capture is the one step
            // that can lose audio, and memo order in the graph must survive.
            parked = capture
            error = outcome.message
            publish()
            if (!isErrorSurfaceVisible()) {
              // The error UI is off screen — the failure must still surface
              // somewhere.
              operations.start('Saving audio memo').fail(outcome.message)
            }
          }
        }
      } finally {
        pumping = false
      }
      if (captured) {
        // The watcher (or mobile's in-process write echo) reports the recording
        // write, which feeds the sync engine's commit debounce like any note
        // edit. Transcription is kicked directly rather than waiting on the
        // watcher's own debounce to echo our write back.
        reconciler?.schedule()
      }
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
      enqueue(capture) {
        queue.push(capture)
        pendingCount += 1
        publish()
        void pump()
      },
      reportError(message) {
        error = message
        publish()
      },
      retry() {
        const failed = parked
        if (failed === null) {
          return
        }
        parked = null
        error = null
        queue.unshift(failed)
        pendingCount += 1
        publish()
        void pump()
      },
      discard() {
        const failed = parked
        parked = null
        error = null
        publish()
        if (failed !== null) {
          void (async () => {
            try {
              await failed.onDiscarded?.()
            } catch (cause) {
              logger.error('audio memo discard cleanup failed:', cause)
            }
          })()
        }
        void pump()
      },
      dispose() {
        stopConfig()
        stopTranscribing?.()
        reconciler?.dispose()
        reconciler = null
      },
    }
  }

  /** The settings path differs per OS. */
  function micDeniedMessage(): string {
    return platform.isMacosDesktop
      ? 'Microphone access was denied. Allow it in System Settings → Privacy & Security → Microphone.'
      : 'Microphone access was denied. Allow microphone access for Reflect in your system settings.'
  }

  function openSession(options: AudioMemoSessionOptions): AudioMemoSession {
    const { generation, surface } = options
    const listeners = new Set<() => void>()
    let surfaceHidden = options.surfaceHidden
    /** True from the stop click until the recorder hands over the blob. */
    let stopping = false
    let elapsedMs = 0
    let live: LiveSession | null = null
    /** Re-entry guard for the stop click's await gap. */
    let stopGuard = false
    /** The in-flight stop, so a mic click in the gap can chain the next memo. */
    let stopSettled: Promise<void> = Promise.resolve()
    /** Concurrent recorder stops share one result, so the final segment is handed over once. */
    let recorderStop: Promise<void> | null = null

    // The mic button (and its popover) unmount with the sidebar — while
    // hidden, a capture failure must surface as an operation instead.
    const pipeline = openPipeline({
      generation,
      isErrorSurfaceVisible: () => !surfaceHidden,
    })

    const snapshot = (): AudioMemoSessionState => {
      const recorderState = audioRecorder.state()
      const pipelineState = pipeline.getState()
      const unavailableReason = !audioRecorder.isSupported()
        ? UNSUPPORTED_REASON
        : !pipelineState.hasTranscriptionConfig
          ? NO_PROVIDER_REASON
          : null
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
        stream: audioRecorder.stream(),
        pendingCount: pipelineState.pendingCount,
        available: unavailableReason === null,
        unavailableReason,
        error: pipelineState.error,
        canRetry: pipelineState.canRetry,
        recorderState,
      }
    }
    let state = snapshot()

    function publish(): void {
      const next = snapshot()
      if (
        next.phase === state.phase &&
        next.elapsedMs === state.elapsedMs &&
        next.stream === state.stream &&
        next.pendingCount === state.pendingCount &&
        next.unavailableReason === state.unavailableReason &&
        next.error === state.error &&
        next.canRetry === state.canRetry &&
        next.recorderState === state.recorderState
      ) {
        return
      }
      state = next
      for (const listener of listeners) {
        listener()
      }
    }

    function handleSegment(segment: AudioRecorderSegment): void {
      if (segment.audio.kind !== 'blob') {
        throw new Error('the webview audio recorder produced a staged segment')
      }
      const session = live
      if (session === null || session.cancelled) {
        return
      }
      session.memo ??= audioMemoIdentity(session.recordedAt, segment.mimeType)
      const path = audioMemoPartPath(session.memo, segment.part, segment.end)
      pipeline.enqueue({
        audio: segment.audio,
        mimeType: segment.mimeType,
        recordedAt: session.recordedAt,
        segment: { part: segment.part, end: segment.end },
        onCaptured: () => {
          // A cancel may land while this segment's write is in flight — its
          // bytes are durable by now, so the cancel cleanup runs here.
          if (session.cancelled) {
            return deleteSegment(path, generation).catch(() => {})
          }
          session.captured.push(path)
        },
      })
    }

    /** Stop the recorder and hand over the final segment; `null` for a misclick. */
    function stopRecorder(): Promise<void> {
      recorderStop ??= (async (): Promise<void> => {
        const final = await audioRecorder.stop()
        if (final !== null) {
          handleSegment(final)
        }
      })().finally(() => {
        recorderStop = null
      })
      return recorderStop
    }

    function cancelRecorder(): void {
      void audioRecorder.cancel()
    }

    async function start(): Promise<void> {
      if (!audioRecorder.isSupported() || !pipeline.getState().hasTranscriptionConfig) {
        return
      }
      if (surfaceHidden) {
        // Never record without visible recording UI.
        surface.reveal()
      }
      try {
        await audioRecorder.start({
          segmentMs: AUDIO_MEMO_SEGMENT_MS,
          reminderMs: AUDIO_MEMO_REMINDER_MS,
        })
        // Identity derives from the session's start — every segment shares it.
        live = { recordedAt: new Date(clock.now()), memo: null, cancelled: false, captured: [] }
      } catch (cause) {
        pipeline.reportError(
          cause instanceof DOMException && cause.name === 'NotAllowedError'
            ? micDeniedMessage()
            : errorMessage(cause),
        )
      }
    }

    function stopAndSave(): Promise<void> {
      if (stopGuard) {
        return Promise.resolve()
      }
      stopGuard = true
      surface.dismissReminder()
      // The stop click commits the memo: flip to 'transcribing' before the stop
      // settles, so an Esc landing in the await gap can't read a lingering
      // 'recording' phase and cancel a recording the user just saved.
      stopping = true
      publish()
      const settled = (async (): Promise<void> => {
        try {
          // Segments (including the final one) flow through the segment
          // handler as the recorder rotates; the stop only flushes.
          await stopRecorder()
        } finally {
          stopGuard = false
          stopping = false
          publish()
        }
      })()
      stopSettled = settled
      return settled
    }

    const unlisten = [
      pipeline.subscribe(publish),
      audioRecorder.subscribeState((next) => {
        if (next !== 'recording') {
          elapsedMs = 0
        }
        publish()
      }),
      audioRecorder.subscribeLevel((event) => {
        elapsedMs = event.elapsedMs
        publish()
      }),
      audioRecorder.subscribeSegment(handleSegment),
      audioRecorder.subscribeReminder((elapsed) => {
        surface.showReminder(elapsed, () => void stopAndSave())
      }),
    ]

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
          if (stopGuard) {
            // The click landed in the stop's await gap, where the button already
            // reads as the idle mic — honor it as "record the next memo" once
            // the recorder frees, instead of swallowing it on the re-entry guard.
            void stopSettled.then(() => start())
          } else {
            void stopAndSave()
          }
        } else if (recorderState === 'requesting') {
          // A second press while the OS prompt is up aborts the request — the
          // alternative is a click that visibly does nothing.
          cancelRecorder()
        } else if (pipeline.getState().error !== null) {
          // A parked error must never invisibly block recording. Hidden, the
          // error UI doesn't exist — surface it; visible, it was on screen and a
          // fresh record request acknowledges it (the same click the red mic
          // anchor handles).
          if (surfaceHidden) {
            surface.reveal()
          } else {
            pipeline.discard()
          }
        } else {
          void start()
        }
      },
      cancel() {
        surface.dismissReminder()
        const session = live
        if (session !== null) {
          // Discard means discard: segments already on disk go too. Segments
          // whose write is still in flight delete themselves via onCaptured.
          session.cancelled = true
          for (const path of session.captured) {
            void deleteSegment(path, generation).catch(() => {})
          }
          session.captured = []
        }
        cancelRecorder()
      },
      retry() {
        pipeline.retry()
      },
      discard() {
        pipeline.discard()
      },
      setSurfaceHidden(hidden) {
        surfaceHidden = hidden
        if (!hidden) {
          return
        }
        const recorderState = audioRecorder.state()
        if (recorderState === 'recording') {
          void stopAndSave()
        } else if (recorderState === 'requesting') {
          cancelRecorder()
        }
      },
      dispose() {
        for (const stop of unlisten) {
          stop()
        }
        // Never leave the mic open past the session.
        cancelRecorder()
        pipeline.dispose()
      },
    }
  }

  return {
    capturePart,
    async listSegments(memo, generation) {
      const files = await noteFile.listDir(AUDIO_MEMOS_DIR, generation)
      return files
        .filter((file) => audioMemoPartFromPath(file.path)?.memo.base === memo.base)
        .map((file) => file.path)
    },
    deleteSegment,
    openPipeline,
    openSession,
  }
}
