import type {
  AudioRecorderFinalSegment,
  AudioRecorderSegment,
  AudioRecorderService,
  AudioRecorderState,
  AudioRecorderStopped,
  RecordingLevelEvent,
  RecordingNativeActionEvent,
  StagedRecordingFile,
  StartRecordingOptions,
} from '../audio/audio-recorder-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'

export type AudioRecorderCall =
  | { method: 'start'; options: StartRecordingOptions }
  | {
      method: 'stop' | 'cancel' | 'status' | 'listStaged' | 'actionsReady' | 'actionPerformed'
    }
  | { method: 'deleteStaged'; path: string }

export interface TestAudioRecorderService extends AudioRecorderService {
  /** Every recorder call, in order. */
  calls(): readonly AudioRecorderCall[]
  /** What the next `stop` resolves; `null` (a misclick) until set. */
  setStopResult(segment: AudioRecorderFinalSegment | null): void
  setStaged(files: readonly StagedRecordingFile[]): void
  emitLevel(event: RecordingLevelEvent): void
  emitSegment(segment: AudioRecorderSegment): void
  /** Ends the session as the recorder would, then notifies listeners. */
  emitStopped(stopped: AudioRecorderStopped): void
  emitReminder(elapsedMs: number): void
  emitNativeAction(event: RecordingNativeActionEvent): void
}

/**
 * An in-memory {@link AudioRecorderService}. `start` moves straight to
 * `recording` with the session stamp `sessionStartedMs`; `stop` and `cancel`
 * return to `idle`.
 */
export function createTestAudioRecorderService(options?: {
  sessionStartedMs?: number
  supported?: boolean
}): TestAudioRecorderService {
  const sessionStartedMs = options?.sessionStartedMs ?? 0
  let state: AudioRecorderState = 'idle'
  let stopResult: AudioRecorderFinalSegment | null = null
  let staged: StagedRecordingFile[] = []
  const log: AudioRecorderCall[] = []
  const claimed = new Set<string>()
  const stateListeners = new Set<(state: AudioRecorderState) => void>()
  const levelListeners = new Set<(event: RecordingLevelEvent) => void>()
  const segmentListeners = new Set<(segment: AudioRecorderSegment) => void>()
  const stoppedListeners = new Set<(stopped: AudioRecorderStopped) => void>()
  const reminderListeners = new Set<(elapsedMs: number) => void>()
  const nativeActionListeners = new Set<(event: RecordingNativeActionEvent) => void>()

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

  return {
    isSupported: () => options?.supported ?? true,
    state: () => state,
    subscribeState: subscribe(stateListeners),
    stream: () => null,
    start(startOptions) {
      log.push({ method: 'start', options: { ...startOptions } })
      if (state !== 'idle') {
        return Promise.resolve(null)
      }
      setState('recording')
      return Promise.resolve({ sessionStartedMs })
    },
    stop() {
      log.push({ method: 'stop' })
      setState('idle')
      if (stopResult?.audio.kind === 'staged') {
        claimed.add(stopResult.audio.path)
      }
      return Promise.resolve(stopResult)
    },
    cancel() {
      log.push({ method: 'cancel' })
      setState('idle')
      return Promise.resolve()
    },
    status() {
      log.push({ method: 'status' })
      return Promise.resolve({ recording: state === 'recording', elapsedMs: 0 })
    },
    listStaged() {
      log.push({ method: 'listStaged' })
      return Promise.resolve(staged.map((file) => ({ ...file })))
    },
    deleteStaged(path) {
      log.push({ method: 'deleteStaged', path })
      staged = staged.filter((file) => file.path !== path)
      return Promise.resolve()
    },
    claimStaged(path) {
      claimed.add(path)
    },
    releaseStaged(path) {
      claimed.delete(path)
    },
    isStagedClaimed: (path) => claimed.has(path),
    actionsReady() {
      log.push({ method: 'actionsReady' })
      return Promise.resolve()
    },
    actionPerformed() {
      log.push({ method: 'actionPerformed' })
      return Promise.resolve()
    },
    subscribeLevel: subscribe(levelListeners),
    subscribeSegment: subscribe(segmentListeners),
    subscribeStopped: subscribe(stoppedListeners),
    subscribeReminder: subscribe(reminderListeners),
    subscribeNativeAction: subscribe(nativeActionListeners),

    calls: () => [...log],
    setStopResult(segment) {
      stopResult = segment
    },
    setStaged(files) {
      staged = [...files]
    },
    emitLevel(event) {
      emit(levelListeners, event)
    },
    emitSegment(segment) {
      emit(segmentListeners, segment)
    },
    emitStopped(stopped) {
      setState('idle')
      emit(stoppedListeners, stopped)
    },
    emitReminder(elapsedMs) {
      emit(reminderListeners, elapsedMs)
    },
    emitNativeAction(event) {
      emit(nativeActionListeners, event)
    },
  }
}
