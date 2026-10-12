import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  defaultAudioRecorder,
  type AudioRecorderSegment,
  type AudioRecorderService,
  type AudioRecorderState,
} from '@reflect/core'

/**
 * Microphone recording for audio memos as a React hook over the process-wide
 * `AudioRecorderService` (the webview's MediaRecorder on desktop): status,
 * elapsed time, the live stream for the waveform, and every finished
 * segment. Capture and transcription belong to the audio-memo provider.
 */

export type RecorderStatus = AudioRecorderState

/** One finished segment, handed over the moment its recorder stopped. */
export interface RecorderSegment {
  blob: Blob
  /** The container the recorder actually produced (codec parameters intact). */
  mimeType: string
  /** 1-based position within the recording session. */
  part: number
  /** True on the session's final segment. */
  end: boolean
}

export interface RecorderResult {
  mimeType: string
  durationMs: number
  /** How many segments the session emitted via `onSegment`. */
  parts: number
}

export interface UseAudioRecorderOptions {
  /** Rotate the recorder each time the session grows by this much. */
  segmentMs?: number
  /** Fire `onReminder` each time the session crosses another multiple of this. */
  reminderMs?: number
  /** The session is still running; the host nudges the user. */
  onReminder?: (elapsedMs: number) => void
  /** Receives every finished segment, including the final one on stop. */
  onSegment?: (segment: RecorderSegment) => void
}

export interface UseAudioRecorderValue {
  status: RecorderStatus
  /** Live while recording; 0 otherwise. */
  elapsedMs: number
  /** The live input stream, for waveform visualization. */
  stream: MediaStream | null
  /** Ask for the microphone and start recording. Rejects when access is denied. */
  start: () => Promise<void>
  /** Stop, flush the final segment, and summarize — `null` for a misclick. */
  stop: () => Promise<RecorderResult | null>
  /** Stop and discard everything still unemitted. */
  cancel: () => void
}

function toRecorderSegment(segment: AudioRecorderSegment): RecorderSegment {
  if (segment.audio.kind !== 'blob') {
    throw new Error('the webview audio recorder produced a staged segment')
  }
  return {
    blob: segment.audio.blob,
    mimeType: segment.mimeType,
    part: segment.part,
    end: segment.end,
  }
}

/** True when the platform exposes the recording APIs this hook needs. */
export function isRecordingSupported(): boolean {
  return defaultAudioRecorder().isSupported()
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderValue {
  const [recorder] = useState<AudioRecorderService>(() => defaultAudioRecorder())
  const status = useSyncExternalStore(
    useCallback((onChange: () => void) => recorder.subscribeState(onChange), [recorder]),
    useCallback(() => recorder.state(), [recorder]),
  )
  const stream = useSyncExternalStore(
    useCallback((onChange: () => void) => recorder.subscribeState(onChange), [recorder]),
    useCallback(() => recorder.stream(), [recorder]),
  )
  const [elapsedMs, setElapsedMs] = useState(0)

  // Read at fire time, not captured at start: the host's callback identity
  // changes across renders.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    const unlistenState = recorder.subscribeState((next) => {
      if (next !== 'recording') {
        setElapsedMs(0)
      }
    })
    const unlistenLevel = recorder.subscribeLevel((event) => {
      setElapsedMs(event.elapsedMs)
    })
    const unlistenSegment = recorder.subscribeSegment((segment) => {
      optionsRef.current.onSegment?.(toRecorderSegment(segment))
    })
    const unlistenReminder = recorder.subscribeReminder((elapsed) => {
      optionsRef.current.onReminder?.(elapsed)
    })
    return () => {
      unlistenState()
      unlistenLevel()
      unlistenSegment()
      unlistenReminder()
    }
  }, [recorder])

  const start = useCallback(async (): Promise<void> => {
    await recorder.start({
      segmentMs: optionsRef.current.segmentMs ?? Infinity,
      reminderMs: optionsRef.current.reminderMs ?? Infinity,
    })
  }, [recorder])

  /** Concurrent stops share one result, so the final segment is handed over once. */
  const stopPromiseRef = useRef<Promise<RecorderResult | null> | null>(null)
  const stop = useCallback((): Promise<RecorderResult | null> => {
    stopPromiseRef.current ??= (async (): Promise<RecorderResult | null> => {
      const final = await recorder.stop()
      if (final === null) {
        return null
      }
      optionsRef.current.onSegment?.(toRecorderSegment(final))
      return { mimeType: final.mimeType, durationMs: final.durationMs, parts: final.part }
    })().finally(() => {
      stopPromiseRef.current = null
    })
    return stopPromiseRef.current
  }, [recorder])

  const cancel = useCallback((): void => {
    void recorder.cancel()
  }, [recorder])

  // Never leave the mic open past unmount.
  useEffect(() => cancel, [cancel])

  return { status, elapsedMs, stream, start, stop, cancel }
}
