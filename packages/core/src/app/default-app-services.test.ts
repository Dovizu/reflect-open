import { afterEach, describe, expect, it } from 'vitest'
import { createTestClockService } from '../testing/clock.ts'
import { setDefaultClock } from './clock-service.ts'
import { defaultAppServices } from './default-app-services.ts'

afterEach(() => {
  setDefaultClock(null)
})

describe('defaultAppServices', () => {
  it('reads each member from its process-wide default at read time', () => {
    const services = defaultAppServices()
    const first = createTestClockService()
    const second = createTestClockService()

    setDefaultClock(first)
    expect(services.clock).toBe(first)
    setDefaultClock(second)
    expect(services.clock).toBe(second)
  })

  it('throws for a service that has no process-wide default', () => {
    expect(() => defaultAppServices().graphSession).toThrow(/no process-wide default/)
  })
})
