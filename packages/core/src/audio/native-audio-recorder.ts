import type { LoggerService } from '../app/logger-service.ts'
import type { IpcBridgeService, Unlisten } from '../ipc/ipc-service.ts'
import type { PluginEvent, PluginSubscription } from '../ipc/plugin.ts'
import {
  actionPerformedCommand,
  actionsReadyCommand,
  cancelRecordingCommand,
  deleteStagedCommand,
  listStagedCommand,
  recordingLevelEvent,
  recordingNativeActionEvent,
  recordingSegmentEvent,
  recordingStatusCommand,
  recordingStoppedEvent,
  startRecordingCommand,
  stopRecordingCommand,
  type RecordingSessionStart,
  type RecordingStopResponse,
} from '../ipc/recording-plugin.ts'
import {
  MIN_RECORDING_DURATION_MS,
  type AudioRecorderFinalSegment,
  type AudioRecorderService,
  type AudioRecorderState,
} from './audio-recorder-service.ts'

/** All native recordings are AAC in an `.m4a` container. */
export const NATIVE_RECORDING_MIME = 'audio/mp4'

/**
 * The recorder over `plugins/tauri-plugin-recording`. Capture is native:
 * the plugin writes straight into a staging directory it owns, rotates
 * segments and schedules reminders itself, and finalizes the file on
 * interruptions without JS. This service presents that state and claims the
 * staged files it hands out.
 */
export function createNativeAudioRecorder(deps: {
  ipc: IpcBridgeService
  logger: LoggerService
}): AudioRecorderService {
  const { ipc, logger } = deps
  let state: AudioRecorderState = 'idle'
  const stateListeners = new Set<(state: AudioRecorderState) => void>()
  const claimed = new Set<string>()
  let stopping: Promise<AudioRecorderFinalSegment | null> | null = null

  // Read through a function so narrowing from an earlier check does not
  // survive an await that a `recordingStopped` event can cross.
  const currentState = (): AudioRecorderState => state

  const setState = (next: AudioRecorderState): void => {
    if (next === state) {
      return
    }
    state = next
    for (const listener of stateListeners) {
      listener(next)
    }
  }

  /**
   * Claim a finished session's last segment, or drop it as a misclick. Only a
   * one-segment session can be too short to keep: a later segment carries
   * the end marker the session needs to close.
   */
  const claimFinal = (stop: RecordingStopResponse): AudioRecorderFinalSegment | null => {
    claimed.add(stop.path)
    if (stop.part === 1 && stop.durationMs < MIN_RECORDING_DURATION_MS) {
      void deleteStagedCommand(ipc, { request: { path: stop.path } }).catch(() => {})
      claimed.delete(stop.path)
      return null
    }
    return {
      audio: { kind: 'staged', path: stop.path },
      mimeType: NATIVE_RECORDING_MIME,
      sessionStartedMs: stop.sessionStartedMs,
      part: stop.part,
      end: true,
      durationMs: stop.durationMs,
    }
  }

  /**
   * Fan one plugin event out to listeners. The native registration is made
   * on the first listener and dropped with the last, and each payload is
   * handled once however many listeners there are.
   */
  function fanOut<Payload, Value>(
    event: PluginEvent<Payload>,
    handle: (payload: Payload, deliver: (value: Value) => void) => void,
  ): (listener: (value: Value) => void) => Unlisten {
    const listeners = new Set<(value: Value) => void>()
    let subscription: PluginSubscription | null = null
    const deliver = (value: Value): void => {
      for (const listener of listeners) {
        listener(value)
      }
    }
    return (listener) => {
      const entry = (value: Value): void => {
        listener(value)
      }
      listeners.add(entry)
      if (subscription === null) {
        subscription = event(ipc, (payload) => {
          handle(payload, deliver)
        })
        subscription.ready.catch((error: unknown) => {
          logger.error('recording plugin events unavailable', error)
        })
      }
      return () => {
        listeners.delete(entry)
        if (listeners.size === 0 && subscription !== null) {
          subscription.unlisten()
          subscription = null
        }
      }
    }
  }

  return {
    isSupported: () => true,
    state: currentState,
    subscribeState(listener) {
      const entry = (next: AudioRecorderState): void => {
        listener(next)
      }
      stateListeners.add(entry)
      return () => {
        stateListeners.delete(entry)
      }
    },
    stream: () => null,

    async start(options) {
      if (currentState() !== 'idle') {
        return null
      }
      setState('requesting')
      let session: RecordingSessionStart
      try {
        session = await startRecordingCommand(ipc, {
          request: { segmentMs: options.segmentMs, reminderMs: options.reminderMs },
        })
      } catch (error) {
        setState('idle')
        throw error
      }
      // A `recordingStopped` event can end the session while the start is in
      // flight; do not resurrect it.
      if (currentState() === 'requesting') {
        setState('recording')
      }
      return session
    },

    stop() {
      if (stopping !== null) {
        return stopping
      }
      const stopped = (async (): Promise<AudioRecorderFinalSegment | null> => {
        try {
          return claimFinal(await stopRecordingCommand(ipc, {}))
        } finally {
          setState('idle')
        }
      })().finally(() => {
        stopping = null
      })
      stopping = stopped
      return stopped
    },

    async cancel() {
      // Also aborts a pending permission request natively.
      try {
        await cancelRecordingCommand(ipc, {})
      } finally {
        setState('idle')
      }
    },

    status: () => recordingStatusCommand(ipc, {}),
    async listStaged() {
      return (await listStagedCommand(ipc, {})).files
    },
    async deleteStaged(path) {
      await deleteStagedCommand(ipc, { request: { path } })
    },
    claimStaged(path) {
      claimed.add(path)
    },
    releaseStaged(path) {
      claimed.delete(path)
    },
    isStagedClaimed: (path) => claimed.has(path),

    async actionsReady() {
      // A queued action is delivered on this call, so the `nativeAction`
      // listener must be registered first.
      const probe = recordingNativeActionEvent(ipc, () => {})
      try {
        await probe.ready
      } finally {
        probe.unlisten()
      }
      await actionsReadyCommand(ipc, {})
    },
    async actionPerformed() {
      await actionPerformedCommand(ipc, {})
    },

    subscribeLevel: fanOut(recordingLevelEvent, (event, deliver) => {
      if (state === 'recording') {
        deliver(event)
      }
    }),
    subscribeSegment: fanOut(recordingSegmentEvent, (event, deliver) => {
      claimed.add(event.path)
      deliver({
        audio: { kind: 'staged', path: event.path },
        mimeType: NATIVE_RECORDING_MIME,
        sessionStartedMs: event.sessionStartedMs,
        part: event.part,
        end: false,
      })
    }),
    subscribeStopped: fanOut(recordingStoppedEvent, (event, deliver) => {
      setState('idle')
      deliver({ segment: claimFinal(event), reason: event.reason })
    }),
    // The plugin schedules reminders as notifications itself.
    subscribeReminder: () => () => {},
    subscribeNativeAction: fanOut(recordingNativeActionEvent, (event, deliver) => {
      deliver(event)
    }),
  }
}
