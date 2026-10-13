import { describe, expect, it } from 'vitest'
import { createTestAppServices } from '../testing/services.ts'
import { createGraphServices } from './create-graph-services.ts'
import { createGraphSession } from './graph-session.ts'

describe('createGraphServices', () => {
  it('holds the app services, the session, and the role', () => {
    const app = createTestAppServices()
    const controller = new AbortController()
    const session = createGraphSession(
      { root: '/g', name: 'g', generation: 3, indexGeneration: 5 },
      controller.signal,
    )
    const graph = createGraphServices(app, session, 'note-window')
    expect(graph).toEqual({ app, session, role: 'note-window' })
    controller.abort()
    expect(graph.session.signal.aborted).toBe(true)
  })
})
