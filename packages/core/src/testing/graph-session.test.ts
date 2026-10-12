import { describe, expect, it } from 'vitest'
import { createTestGraphSessionService } from './graph-session.ts'

describe('createTestGraphSessionService', () => {
  it('starts with the given graph open and ready', () => {
    const service = createTestGraphSessionService({
      graph: { root: '/graphs/work', name: 'Work', generation: 3, indexGeneration: 7 },
    })

    expect(service.getState()).toMatchObject({
      status: 'ready',
      graph: { root: '/graphs/work', name: 'Work', generation: 3 },
      indexGeneration: 7,
      session: { root: '/graphs/work', name: 'Work', generation: 3, indexGeneration: 7 },
    })
  })

  it('reports a graph without an index session when the index generation is null', () => {
    const service = createTestGraphSessionService({ graph: { indexGeneration: null } })

    expect(service.getState()).toMatchObject({
      status: 'ready',
      graph: { root: '/graphs/test', name: 'test', generation: 1 },
      indexGeneration: null,
      session: null,
    })
  })

  it('switches the reported graph and notifies subscribers', () => {
    const service = createTestGraphSessionService({ graph: {} })
    let notified = 0
    service.subscribe(() => {
      notified += 1
    })

    service.setGraph({ root: '/graphs/work' })
    expect(service.getState().graph?.root).toBe('/graphs/work')

    service.setGraph(null)
    expect(service.getState()).toMatchObject({ status: 'choosing', graph: null, session: null })
    expect(notified).toBe(2)
  })
})
