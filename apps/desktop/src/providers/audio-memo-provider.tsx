import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  defaultAudioMemo,
  type AudioMemoPhase,
  type AudioMemoSession,
  type AudioMemoSessionState,
  type GraphInfo,
} from '@reflect/core'
import {
  dismissRecordingReminder,
  showRecordingReminder,
} from '@/components/audio-memo/recording-reminder.ts'
import { useSidebar } from '@/providers/sidebar-provider.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * The desktop React surface for audio memos: a thin shell over the
 * `AudioMemoService` session of the open graph, which owns the recorder state,
 * the capture queue, and the transcription lifecycle. The session is opened
 * here — above the sidebar — because the mic button unmounts with the sidebar
 * (`Mod-\`); the shell tells the session when the sidebar collapses, and the
 * session stops and saves instead of leaving a hidden hot microphone.
 */

export type { AudioMemoPhase }

interface AudioMemoContextValue {
  phase: AudioMemoPhase
  /** Live while recording. */
  elapsedMs: number
  /** The live input stream, for the waveform. */
  stream: MediaStream | null
  /** Recordings committed but not yet written to the graph. */
  pendingCount: number
  /** False when no OpenAI/Gemini model is configured or the platform can't record. */
  available: boolean
  /** Why the mic is disabled (tooltip copy), null when `available`. */
  unavailableReason: string | null
  /** The failure shown in the error phase. */
  error: string | null
  /** True when a retry can re-run the failed capture. */
  canRetry: boolean
  /** Idle → start recording (expanding a collapsed sidebar); recording → stop & save. */
  toggle: () => void
  /** Discard the in-flight recording without saving. */
  cancel: () => void
  /** Re-run the failed capture. */
  retry: () => void
  /** Drop the failed memo and let the queue continue. */
  discard: () => void
}

const AudioMemoContext = createContext<AudioMemoContextValue | null>(null)

/** What the surface shows before the session opens. */
const CLOSED_STATE: AudioMemoSessionState = {
  phase: 'idle',
  elapsedMs: 0,
  stream: null,
  pendingCount: 0,
  available: false,
  unavailableReason: null,
  error: null,
  canRetry: false,
  recorderState: 'idle',
}

function subscribeClosed(): () => void {
  return () => {}
}

function getClosedState(): AudioMemoSessionState {
  return CLOSED_STATE
}

interface AudioMemoProviderProps {
  graph: GraphInfo
  children: ReactNode
}

export function AudioMemoProvider({ graph, children }: AudioMemoProviderProps): ReactElement {
  const audioMemo = useAppServices({ optional: true })?.audioMemo ?? defaultAudioMemo()
  const { collapsed, toggleSidebar } = useSidebar()

  // Read at call time: the session outlives the renders that made these.
  const collapsedRef = useRef(collapsed)
  const toggleSidebarRef = useRef(toggleSidebar)
  useEffect(() => {
    collapsedRef.current = collapsed
    toggleSidebarRef.current = toggleSidebar
  })

  // Opened before paint, so the mic never shows the closed state.
  const [session, setSession] = useState<AudioMemoSession | null>(null)
  useLayoutEffect(() => {
    const next = audioMemo.openSession({
      generation: graph.generation,
      surfaceHidden: collapsedRef.current,
      surface: {
        reveal: () => {
          toggleSidebarRef.current()
        },
        showReminder: showRecordingReminder,
        dismissReminder: dismissRecordingReminder,
      },
    })
    setSession(next)
    return () => {
      next.dispose()
      setSession((current) => (current === next ? null : current))
    }
  }, [audioMemo, graph.generation])

  const state = useSyncExternalStore(
    session?.subscribe ?? subscribeClosed,
    session?.getState ?? getClosedState,
  )

  // The mic button (and its popover) unmount with the sidebar. The session
  // decides what a hidden surface means for a live recording or a pending
  // permission request; it needs the answer again after each recorder change.
  const recorderState = state.recorderState
  useEffect(() => {
    session?.setSurfaceHidden(collapsed)
  }, [session, collapsed, recorderState])

  const controls = useMemo(
    () => ({
      toggle: () => session?.toggle(),
      cancel: () => session?.cancel(),
      retry: () => session?.retry(),
      discard: () => session?.discard(),
    }),
    [session],
  )
  const value = useMemo<AudioMemoContextValue>(
    () => ({
      phase: state.phase,
      elapsedMs: state.elapsedMs,
      stream: state.stream,
      pendingCount: state.pendingCount,
      available: state.available,
      unavailableReason: state.unavailableReason,
      error: state.error,
      canRetry: state.canRetry,
      ...controls,
    }),
    [state, controls],
  )

  return <AudioMemoContext value={value}>{children}</AudioMemoContext>
}

/** Access the audio-memo surface. Use within an AudioMemoProvider. */
export function useAudioMemo(): AudioMemoContextValue {
  const context = use(AudioMemoContext)
  if (!context) {
    throw new Error('useAudioMemo must be used within an AudioMemoProvider')
  }
  return context
}
