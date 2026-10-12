import type { ReactElement, ReactNode } from 'react'
import { defaultCapture, type GraphInfo } from '@reflect/core'
import { useMainWindowEffect } from '@/hooks/use-main-window-effect.ts'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * Mounts the link-capture lifecycle for the open graph (Plan 11): has the
 * app-lifetime `CaptureService` open a session for this graph, which registers
 * the native-messaging host on desktop and runs the drain/enrich loop. No UI —
 * capture has no in-app surface; the capture front end is the Chrome extension
 * on desktop and the share extension on iOS, and the daily note is the output.
 */

interface CaptureProviderProps {
  graph: GraphInfo
  children: ReactNode
}

export function CaptureProvider({ graph, children }: CaptureProviderProps): ReactElement {
  const capture = useAppServices({ optional: true })?.capture ?? defaultCapture()

  // One drain per app: a secondary note window running its own would race
  // the main window's over the same spooled envelopes.
  useMainWindowEffect(() => {
    const session = capture.openSession({ generation: graph.generation })
    session.start()
    return () => {
      session.dispose()
    }
  }, [capture, graph.generation])

  return <>{children}</>
}
