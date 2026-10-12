import { describe, expect, it } from 'vitest'
import { legacySession } from '@/lib/legacy-session.ts'

const graph = { root: '/g', name: 'g', generation: 3 }

describe('legacySession', () => {
  it('builds a session from the graph and the index generation', () => {
    const controller = new AbortController()
    const session = legacySession({ graph, indexGeneration: 5 }, controller.signal)
    expect(session).toMatchObject({ root: '/g', name: 'g', generation: 3, indexGeneration: 5 })
    expect(session?.signal).toBe(controller.signal)
  })

  it('is null while no index session is open', () => {
    expect(legacySession({ graph, indexGeneration: null })).toBeNull()
  })
})
