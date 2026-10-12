import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderHook } from 'vitest-browser-react'
import { setDefaultClock } from '@reflect/core'
import { createTestClockService } from '@reflect/core/testing'
import { useToday } from './use-today.ts'

afterEach(() => {
  setDefaultClock(null)
})

describe('useToday', () => {
  it('follows the clock when the local date changes', async () => {
    const clock = createTestClockService({ today: '2026-06-09' })
    setDefaultClock(clock)
    const { result, unmount } = await renderHook(() => useToday())
    expect(result.current).toBe('2026-06-09')

    act(() => {
      clock.setToday('2026-06-10')
    })
    expect(result.current).toBe('2026-06-10')

    act(() => {
      clock.setToday('2026-06-11')
    })
    expect(result.current).toBe('2026-06-11')
    await unmount()
  })

  it('rolls over when time advances past local midnight', async () => {
    const clock = createTestClockService({ now: new Date(2026, 5, 9, 23, 59, 0).getTime() })
    setDefaultClock(clock)
    const { result, unmount } = await renderHook(() => useToday())
    expect(result.current).toBe('2026-06-09')

    await act(async () => {
      await clock.advance(2 * 60 * 1000)
    })
    expect(result.current).toBe('2026-06-10')
    await unmount()
  })

  it('mounted hooks share the same date', async () => {
    const clock = createTestClockService({ today: '2026-06-09' })
    setDefaultClock(clock)
    const first = await renderHook(() => useToday())
    const second = await renderHook(() => useToday())

    act(() => {
      clock.setToday('2026-06-10')
    })
    expect(first.result.current).toBe('2026-06-10')
    expect(second.result.current).toBe('2026-06-10')
    await first.unmount()
    await second.unmount()
  })
})
