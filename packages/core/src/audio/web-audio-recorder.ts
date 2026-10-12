import type { ClockService, TimerHandle } from '../app/clock-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type {
  RecordingLevelEvent,
  RecordingSessionStart,
  StartRecordingOptions,
} from '../ipc/recording-plugin.ts'
import {
  MIN_RECORDING_DURATION_MS,
  type AudioRecorderFinalSegment,
  type AudioRecorderSegment,
  type AudioRecorderService,
  type AudioRecorderState,
} from './audio-recorder-service.ts'

/** The part of a `MediaRecorder` the web recorder drives. */
export interface WebMediaRecorder {
  readonly state: RecordingState
  readonly mimeType: string
  ondataavailable: ((event: BlobEvent) => void) | null
  onstop: ((event: Event) => void) | null
  start(): void
  stop(): void
}

/** The part of the `MediaRecorder` constructor the web recorder uses. */
export interface WebMediaRecorderConstructor {
  new (stream: MediaStream, options?: MediaRecorderOptions): WebMediaRecorder
  isTypeSupported(type: string): boolean
}

/** The part of `navigator.mediaDevices` the web recorder uses. */
export interface WebMediaDevices {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
}

/**
 * Preference order matters per platform: Chrome and WebView2 take the
 * opus-in-webm entries; WKWebView supports none of them and falls through to
 * `audio/mp4` (AAC). Both containers are accepted by the transcription
 * providers.
 */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

/**
 * Speech-quality encode target. Left to its defaults, MediaRecorder picks
 * music-grade bitrates that roughly double a segment's size. Encoders clamp
 * unsupported values, never throw.
 */
const AUDIO_BITS_PER_SECOND = 64_000

const ELAPSED_TICK_MS = 200

const FALLBACK_MIME_TYPE = 'audio/mp4'

/** Settle once `recorder` has stopped (immediately when it already has). */
function stopInstance(recorder: WebMediaRecorder): Promise<void> {
  return new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
    if (recorder.state === 'inactive') {
      // Already stopped (a cancel raced us): its onstop may never fire, and
      // stop() on an inactive recorder throws.
      resolve()
    } else {
      recorder.stop()
    }
  })
}

function isUsableInterval(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0
}

/**
 * The recorder over the webview's `MediaRecorder`. The microphone stream is
 * acquired once per session and stays open across rotations; only the
 * recorder attached to it is swapped, so each segment is a complete,
 * independently decodable container. Rotation and reminders run off elapsed
 * time on a short tick, so a throttled timer fires late but always fires.
 *
 * `MediaRecorder` and `mediaDevices` default to the globals, read at call
 * time. There is no staging directory and no native action, so those
 * methods are inert; level events carry the elapsed time with a level of 0,
 * and the waveform reads {@link AudioRecorderService.stream} instead.
 */
export function createWebAudioRecorder(deps: {
  clock: ClockService
  mediaDevices?: WebMediaDevices
  MediaRecorder?: WebMediaRecorderConstructor
}): AudioRecorderService {
  const { clock } = deps

  const recorderClass = (): WebMediaRecorderConstructor | undefined =>
    deps.MediaRecorder ?? (typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder)
  const mediaDevices = (): WebMediaDevices | undefined =>
    deps.mediaDevices ??
    (typeof globalThis.navigator === 'undefined' ? undefined : globalThis.navigator.mediaDevices)

  let state: AudioRecorderState = 'idle'
  const stateListeners = new Set<(state: AudioRecorderState) => void>()
  const levelListeners = new Set<(event: RecordingLevelEvent) => void>()
  const segmentListeners = new Set<(segment: AudioRecorderSegment) => void>()
  const reminderListeners = new Set<(elapsedMs: number) => void>()
  const claimed = new Set<string>()

  let recorder: WebMediaRecorder | null = null
  let input: MediaStream | null = null
  let chunks: Blob[] = []
  let startedAt = 0
  let ticker: TimerHandle | null = null
  /** Recorder constructor options, fixed per session so every segment matches. */
  let recorderInit: MediaRecorderOptions = {}
  let segmentMs = 0
  let reminderMs = 0
  /** Segments emitted so far this session. */
  let parts = 0
  /** Elapsed time the next rotation is due at, bumped when one is scheduled. */
  let rotateAt = 0
  /** Reminder boundaries already crossed this session. */
  let reminders = 0
  /** Serializes rotations against stop: each op awaits the previous onstop. */
  let opChain: Promise<void> = Promise.resolve()
  /** Bumped by teardown, so an in-flight start resolves into a dead session. */
  let session = 0
  /** Guards start's await gap, so overlapping starts acquire one stream. */
  let requesting = false
  let stopping: Promise<AudioRecorderFinalSegment | null> | null = null

  // Read through functions so narrowing from an earlier check does not
  // survive an await.
  const currentRecorder = (): WebMediaRecorder | null => recorder
  const currentSession = (): number => session

  function subscribe<Value>(listeners: Set<(value: Value) => void>) {
    return (listener: (value: Value) => void): Unlisten => {
      const entry = (value: Value): void => {
        listener(value)
      }
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    }
  }

  function emit<Value>(listeners: Set<(value: Value) => void>, value: Value): void {
    for (const listener of listeners) {
      listener(value)
    }
  }

  const setState = (next: AudioRecorderState): void => {
    if (next === state) {
      return
    }
    state = next
    emit(stateListeners, next)
  }

  const pickMimeType = (): string | undefined => {
    const MediaRecorderClass = recorderClass()
    return MIME_CANDIDATES.find(
      (candidate) => MediaRecorderClass?.isTypeSupported(candidate) ?? false,
    )
  }

  const mimeOf = (current: WebMediaRecorder): string =>
    current.mimeType || pickMimeType() || FALLBACK_MIME_TYPE

  const stopTracks = (stream: MediaStream): void => {
    for (const track of stream.getTracks()) {
      track.stop()
    }
  }

  const teardown = (): void => {
    session += 1
    requesting = false
    recorder = null
    chunks = []
    parts = 0
    rotateAt = 0
    reminders = 0
    if (ticker !== null) {
      clock.clearInterval(ticker)
      ticker = null
    }
    if (input !== null) {
      stopTracks(input)
    }
    input = null
    setState('idle')
  }

  const attachRecorder = (stream: MediaStream): WebMediaRecorder => {
    const MediaRecorderClass = recorderClass()
    if (MediaRecorderClass === undefined) {
      throw new Error('MediaRecorder is not available')
    }
    const next = new MediaRecorderClass(stream, recorderInit)
    next.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }
    next.start()
    recorder = next
    return next
  }

  /**
   * Finish the current segment and start the next recorder on the same
   * stream. Chained so a stop arriving mid-rotation waits for the swap.
   */
  const rotate = (): void => {
    opChain = opChain.then(async () => {
      const current = recorder
      const stream = input
      if (current === null || stream === null || stopping !== null) {
        return
      }
      const owner = session
      await stopInstance(current)
      if (currentSession() !== owner) {
        // Cancelled while the segment was flushing; teardown owns cleanup.
        return
      }
      const mimeType = mimeOf(current)
      const blob = new Blob(chunks, { type: mimeType })
      chunks = []
      parts += 1
      emit(segmentListeners, {
        audio: { kind: 'blob', blob },
        mimeType,
        sessionStartedMs: startedAt,
        part: parts,
        end: false,
      })
      attachRecorder(stream)
    })
  }

  const tick = (): void => {
    const elapsedMs = clock.now() - startedAt
    emit(levelListeners, { level: 0, elapsedMs })
    if (isUsableInterval(segmentMs) && elapsedMs >= rotateAt) {
      // Move the boundary when a rotation is scheduled, not when it lands:
      // `parts` only advances once the old recorder has flushed, so a flush
      // outliving a tick would queue a second rotation that cuts the fresh
      // recorder into a near-empty segment. Measuring from `elapsedMs` also
      // means a machine that slept through several boundaries rotates once.
      rotateAt = elapsedMs + segmentMs
      rotate()
    }
    if (isUsableInterval(reminderMs)) {
      // A machine that slept through several boundaries owes one nudge.
      const due = Math.floor(elapsedMs / reminderMs)
      if (due > reminders) {
        reminders = due
        emit(reminderListeners, elapsedMs)
      }
    }
  }

  return {
    isSupported() {
      return recorderClass() !== undefined && typeof mediaDevices()?.getUserMedia === 'function'
    },
    state: () => state,
    subscribeState: subscribe(stateListeners),
    stream: () => input,

    async start(options: StartRecordingOptions): Promise<RecordingSessionStart | null> {
      if (requesting || recorder !== null || input !== null) {
        return null
      }
      const devices = mediaDevices()
      if (devices === undefined) {
        throw new Error('mediaDevices is not available')
      }
      requesting = true
      const owner = session
      setState('requesting')
      let stream: MediaStream
      try {
        stream = await devices.getUserMedia({ audio: true })
      } catch (error) {
        if (currentSession() === owner) {
          requesting = false
          setState('idle')
        }
        throw error
      }
      if (currentSession() !== owner) {
        // Cancelled while pending; a newer start may own `requesting` now.
        stopTracks(stream)
        return null
      }
      requesting = false

      const mimeType = pickMimeType()
      recorderInit = {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      }
      segmentMs = options.segmentMs
      reminderMs = options.reminderMs
      try {
        chunks = []
        parts = 0
        rotateAt = segmentMs
        reminders = 0
        attachRecorder(stream)
      } catch (error) {
        // A recorder that failed to set up must not strand the stream hot or
        // the state at `requesting`.
        stopTracks(stream)
        recorder = null
        setState('idle')
        throw error
      }

      input = stream
      startedAt = clock.now()
      ticker = clock.setInterval(tick, ELAPSED_TICK_MS)
      setState('recording')
      return { sessionStartedMs: startedAt }
    },

    stop() {
      // Concurrent stops share one in-flight promise: a second
      // MediaRecorder.stop() would throw and replace the first onstop.
      if (stopping !== null) {
        return stopping
      }
      if (recorder === null) {
        teardown()
        return Promise.resolve(null)
      }
      const stopped = (async (): Promise<AudioRecorderFinalSegment | null> => {
        await opChain
        const current = currentRecorder()
        if (current === null) {
          teardown()
          return null
        }
        const durationMs = clock.now() - startedAt
        await stopInstance(current)
        const mimeType = mimeOf(current)
        const blob = new Blob(chunks, { type: mimeType })
        if (parts === 0 && (durationMs < MIN_RECORDING_DURATION_MS || blob.size === 0)) {
          teardown()
          return null
        }
        // The final segment always ships, however small: it carries the
        // session's end marker.
        const final: AudioRecorderFinalSegment = {
          audio: { kind: 'blob', blob },
          mimeType,
          sessionStartedMs: startedAt,
          part: parts + 1,
          end: true,
          durationMs,
        }
        teardown()
        return final
      })().finally(() => {
        stopping = null
      })
      stopping = stopped
      return stopped
    },

    cancel() {
      const current = recorder
      if (current !== null && current.state !== 'inactive') {
        current.onstop = null
        current.stop()
      }
      teardown()
      return Promise.resolve()
    },

    async status() {
      return {
        recording: state === 'recording',
        elapsedMs: state === 'recording' ? clock.now() - startedAt : 0,
      }
    },
    listStaged: async () => [],
    deleteStaged: async () => {},
    claimStaged(path) {
      claimed.add(path)
    },
    releaseStaged(path) {
      claimed.delete(path)
    },
    isStagedClaimed: (path) => claimed.has(path),
    actionsReady: async () => {},
    actionPerformed: async () => {},

    subscribeLevel: subscribe(levelListeners),
    subscribeSegment: subscribe(segmentListeners),
    subscribeStopped: () => () => {},
    subscribeReminder: subscribe(reminderListeners),
    subscribeNativeAction: () => () => {},
  }
}
