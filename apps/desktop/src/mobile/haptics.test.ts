import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setDefaultHaptics } from '@reflect/core'
import { createTestHapticsService, type TestHapticsService } from '@reflect/core/testing'
import { hapticImpactLight } from './haptics.ts'

let haptics: TestHapticsService

beforeEach(() => {
  haptics = createTestHapticsService()
  setDefaultHaptics(haptics)
})

afterEach(() => {
  setDefaultHaptics(null)
})

describe('hapticImpactLight', () => {
  it('fires a light impact on every call', () => {
    hapticImpactLight()
    hapticImpactLight()

    expect(haptics.impacts()).toBe(2)
  })

  it('swallows a failing haptic engine', async () => {
    const failing = createTestHapticsService({ fail: true })
    setDefaultHaptics(failing)

    hapticImpactLight()
    await Promise.resolve()

    expect(failing.impacts()).toBe(1)
  })
})
