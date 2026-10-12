import {
  createContext,
  use,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import type {
  AudioMemoPhase,
  GraphInfo,
  MobileAudioMemoSession,
  MobileAudioMemoSessionState,
} from '@reflect/core'
import { useMobileAppServices } from '@/mobile/mobile-services.ts'

/**
 * The mobile React surface for audio memos: a thin shell over the
 * `MobileAudioMemoService` session of the open graph, which owns the native
 * recorder state, the capture queue, the orphan scan, and the native-action
 * handshake. Desktop's provider presents recording in a sidebar popover; here
 * it is a bottom drawer plus the mic action in the Daily capture menu.
 */

interface MobileAudioMemoContextValue {
  phase: AudioMemoPhase
  /** Live while recording. */
  elapsedMs: number
  /** Latest input level 0…1, for the waveform. */
  level: number
  /** Recordings committed but not yet written to the graph. */
  pendingCount: number
  /** False without the native shell (the recorder is a native plugin). */
  available: boolean
  /** False when no OpenAI/Gemini model is configured; the drawer then guides key setup. */
  hasTranscriptionConfig: boolean
  /** The failure shown in the error phase. */
  error: string | null
  /** True when a retry can re-run the failed capture. */
  canRetry: boolean
  /** The recording drawer's visibility. */
  drawerOpen: boolean
  /** Audio action tap: idle → record (or key setup); recording → stop & save; error → show it. */
  toggle: () => void
  /** The drawer's stop control — commit the memo. */
  stopAndSave: () => void
  /** The drawer's discard control — drop the live recording. */
  cancelRecording: () => void
  /** Drawer dismissal: a live recording stops-and-saves, never silently drops. */
  onDrawerOpenChange: (open: boolean) => void
  /** Re-run the failed capture. */
  retry: () => void
  /** Drop the failed memo and let the queue continue. */
  discard: () => void
}

const MobileAudioMemoContext = createContext<MobileAudioMemoContextValue | null>(null)

/** What the surface shows before the session opens. */
const CLOSED_STATE: MobileAudioMemoSessionState = {
  phase: 'idle',
  elapsedMs: 0,
  level: 0,
  pendingCount: 0,
  available: false,
  hasTranscriptionConfig: false,
  error: null,
  canRetry: false,
  drawerOpen: false,
}

function subscribeClosed(): () => void {
  return () => {}
}

function getClosedState(): MobileAudioMemoSessionState {
  return CLOSED_STATE
}

interface MobileAudioMemoProviderProps {
  graph: GraphInfo
  children: ReactNode
}

export function MobileAudioMemoProvider({
  graph,
  children,
}: MobileAudioMemoProviderProps): ReactElement {
  const { mobileAudioMemo } = useMobileAppServices()

  // Opened before paint, so the mic action never shows the closed state.
  const [session, setSession] = useState<MobileAudioMemoSession | null>(null)
  useLayoutEffect(() => {
    const next = mobileAudioMemo.openSession({ generation: graph.generation })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the session is an external resource that this effect opens and disposes
    setSession(next)
    return () => {
      next.dispose()
      setSession((current) => (current === next ? null : current))
    }
  }, [mobileAudioMemo, graph.generation])

  const state = useSyncExternalStore(
    session?.subscribe ?? subscribeClosed,
    session?.getState ?? getClosedState,
  )

  const controls = useMemo(
    () => ({
      toggle: () => session?.toggle(),
      stopAndSave: () => session?.stopAndSave(),
      cancelRecording: () => session?.cancelRecording(),
      onDrawerOpenChange: (open: boolean) => session?.setDrawerOpen(open),
      retry: () => session?.retry(),
      discard: () => session?.discard(),
    }),
    [session],
  )
  const value = useMemo<MobileAudioMemoContextValue>(
    () => ({ ...state, ...controls }),
    [state, controls],
  )

  return <MobileAudioMemoContext value={value}>{children}</MobileAudioMemoContext>
}

/** Access the mobile audio-memo surface. Use within MobileAudioMemoProvider. */
export function useMobileAudioMemo(): MobileAudioMemoContextValue {
  const context = use(MobileAudioMemoContext)
  if (!context) {
    throw new Error('useMobileAudioMemo must be used within a MobileAudioMemoProvider')
  }
  return context
}
