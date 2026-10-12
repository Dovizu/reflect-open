import type { AppServices } from './create-app-services.ts'
import type { GraphSession } from './graph-session.ts'

/** The main window owns the graph; a note window adopts the main window's sessions. */
export type GraphRole = 'main' | 'note-window'

/** The graph-scoped services: one set per {@link GraphSession}. */
export interface GraphServices {
  readonly app: AppServices
  readonly session: GraphSession
  readonly role: GraphRole
}

export function createGraphServices(
  app: AppServices,
  session: GraphSession,
  role: GraphRole,
): GraphServices {
  return { app, session, role }
}
