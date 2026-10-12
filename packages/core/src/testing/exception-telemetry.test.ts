import { describe, expect, it } from 'vitest'
import { createTestExceptionTelemetry } from './exception-telemetry.ts'

describe('createTestExceptionTelemetry', () => {
  it('counts installs and records what the root handlers receive', () => {
    const telemetry = createTestExceptionTelemetry()
    telemetry.install()
    const options = telemetry.reactRootOptions()
    const caught = new Error('caught')
    const uncaught = new Error('uncaught')

    options.onCaughtError?.(caught, { componentStack: 'at App' })
    options.onRecoverableError?.('recovered', {})
    options.onUncaughtError?.(uncaught, { componentStack: undefined })

    expect(telemetry.installCalls()).toBe(1)
    expect(telemetry.reports()).toEqual([
      { source: 'caught', error: caught, componentStack: 'at App' },
      { source: 'recoverable', error: 'recovered', componentStack: undefined },
      { source: 'uncaught', error: uncaught, componentStack: undefined },
    ])
  })

  it('has no root handlers when disabled', () => {
    expect(createTestExceptionTelemetry({ enabled: false }).reactRootOptions()).toEqual({})
  })
})
