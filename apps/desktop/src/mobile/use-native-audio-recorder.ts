import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  defaultAudioRecorder,
  errorMessage,
  NATIVE_RECORDING_MIME,
  type AudioRecorderSegment,
  type AudioRecorderService,
  type AudioRecorderState,
} from '@reflect/core'

/**
 * The mobile counterpart of `use-audio-recorder.ts`: the same
 * status/start/stop/cancel surface over the native recorder plugin
 * (`plugins/tauri-plugin-recording`) instead of the webview's MediaRecorder.
 * Capture is native by design (the V1 lesson): AVAudioRecorder writes
 * straight into a staging directory the plugin owns, rotates itself every
 * segment, and finalizes the file on interruptions and route loss without
 * JS — this hook only *presents* recording state and hands finished segments
 * to the capture pipeline. Backgrounding does not stop a recording (the app
 * declares `UIBackgroundModes: audio`); a session keeps capturing through
 * screen lock, has no duration limit, and ends only on a user stop or an
 * interruption.
 *
 * Instead of a `MediaStream` for the waveform, the plugin streams ~10 Hz
 * `recordingLevel` events; the latest level and elapsed time are exposed as
 * plain state.
 */

export type NativeRecorderStatus = AudioRecorderState

/** All recordings are AAC in an `.m4a` container (see RecordingPlugin.swift). */
export { NATIVE_RECORDING_MIME }

/** One finished segment of a recording session, staged and ready to ingest. */
export interface NativeRecordingPart {
  /** The staged file's absolute path; delete it once the graph write lands. */
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

export interface UseNativeAudioRecorderOptions {
  /** Rotate the recorder this often, natively, so it holds if JS never wakes. */
  segmentMs: number
  /**
   * Remind the user this often while the session runs. The plugin owns the
   * schedule: a session the native side ends must clear the reminder even
   * when the webview is gone.
   */
  reminderMs: number
  /** A segment the recorder rotated away from; the session keeps recording. */
  onSegment: (part: NativeRecordingPart) => void
  /**
   * A stop the native side initiated (interruption, route change): the file
   * is already staged and `-end`-marked — treat it exactly like a user stop.
   * `null` when the session was too short to keep.
   */
  onNativeStop: (part: NativeRecordingPart | null) => void
}

export interface UseNativeAudioRecorderValue {
  status: NativeRecorderStatus
  /** Live while recording; 0 otherwise. */
  elapsedMs: number
  /** Latest input level 0…1, for the waveform. */
  level: number
  /**
   * Ask for the microphone and start a session. Resolves its identity
   * timestamp, or `null` when one was already live. Rejects when denied.
   */
  start: () => Promise<Date | null>
  /** Stop and hand back the final segment — `null` for a session too short to keep. */
  stop: () => Promise<NativeRecordingPart | null>
  /** Stop and discard everything. */
  cancel: () => Promise<void>
}

/** Claim a staged file for a live capture flow. */
export function claimStagedPath(path: string): void {
  defaultAudioRecorder().claimStaged(path)
}

/** Release a claim, after deletion or so the orphan scan can retry it. */
export function releaseStagedPath(path: string): void {
  defaultAudioRecorder().releaseStaged(path)
}

/** True when a live flow owns the staged file. */
export function isStagedPathClaimed(path: string): boolean {
  return defaultAudioRecorder().isStagedClaimed(path)
}

/** True when the native recorder rejected `start` because access was denied. */
export function isMicDeniedError(cause: unknown): boolean {
  return errorMessage(cause).includes('denied')
}

/** Remove a staged recording once its bytes are durable in the graph. */
export async function deleteStagedRecording(path: string): Promise<void> {
  await defaultAudioRecorder().deleteStaged(path)
}

/**
 * Whether a native recording is live right now. A fresh mount checks this to
 * find a recording that outlived its JS (a webview reload or crash mid-memo).
 */
export async function nativeRecordingStatus(): Promise<{
  recording: boolean
  elapsedMs: number
}> {
  return await defaultAudioRecorder().status()
}

function toNativePart(segment: AudioRecorderSegment): NativeRecordingPart {
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

/**
 * Stop the live native session and claim its final segment: `null` for a
 * session too short to be a memo. The shared machinery behind the hook's
 * `stop` and the provider's mount-time reconcile of a recording that
 * outlived its UI. Rejects when nothing is recording (a native finalize won
 * the race: its `recordingStopped` event delivers the memo instead).
 */
export async function stopActiveRecording(): Promise<NativeRecordingPart | null> {
  const final = await defaultAudioRecorder().stop()
  return final === null ? null : toNativePart(final)
}

/**
 * Drive the native recorder as a React hook over the process-wide
 * `AudioRecorderService`. Listens to its level, segment, and stopped events
 * for the hook's whole life, exposes `status`/`elapsedMs`/`level` as state,
 * and returns `start`/`stop`/`cancel`. A native-initiated stop (interruption,
 * route change) is delivered to
 * {@link UseNativeAudioRecorderOptions.onNativeStop}; user-initiated `stop`
 * resolves its own result.
 */
export function useNativeAudioRecorder(
  options: UseNativeAudioRecorderOptions,
): UseNativeAudioRecorderValue {
  const [recorder] = useState<AudioRecorderService>(() => defaultAudioRecorder())
  const status = useSyncExternalStore(
    useCallback((onChange: () => void) => recorder.subscribeState(onChange), [recorder]),
    useCallback(() => recorder.state(), [recorder]),
  )
  const [elapsedMs, setElapsedMs] = useState(0)
  const [level, setLevel] = useState(0)

  // Read at fire time, not captured at subscribe: the host's callback
  // identity changes across renders.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    const unlistenState = recorder.subscribeState((next) => {
      if (next !== 'recording') {
        setElapsedMs(0)
        setLevel(0)
      }
    })
    const unlistenLevel = recorder.subscribeLevel((event) => {
      setLevel(event.level)
      setElapsedMs(event.elapsedMs)
    })
    const unlistenSegment = recorder.subscribeSegment((segment) => {
      optionsRef.current.onSegment(toNativePart(segment))
    })
    const unlistenStopped = recorder.subscribeStopped((stopped) => {
      optionsRef.current.onNativeStop(
        stopped.segment === null ? null : toNativePart(stopped.segment),
      )
    })
    return () => {
      unlistenState()
      unlistenLevel()
      unlistenSegment()
      unlistenStopped()
    }
  }, [recorder])

  const start = useCallback(async (): Promise<Date | null> => {
    const session = await recorder.start({
      segmentMs: optionsRef.current.segmentMs,
      reminderMs: optionsRef.current.reminderMs,
    })
    return session === null ? null : new Date(session.sessionStartedMs)
  }, [recorder])

  const stop = useCallback(async (): Promise<NativeRecordingPart | null> => {
    // A stop in flight keeps the state at `recording` until it settles, and
    // the recorder hands every concurrent caller the same result.
    if (recorder.state() !== 'recording') {
      return null
    }
    const final = await recorder.stop()
    return final === null ? null : toNativePart(final)
  }, [recorder])

  const cancel = useCallback(async (): Promise<void> => {
    await recorder.cancel()
  }, [recorder])

  return { status, elapsedMs, level, start, stop, cancel }
}
