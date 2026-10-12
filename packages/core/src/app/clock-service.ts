import { todayIso } from '../lib/dates.ts'

/** An opaque timer handle owned by a {@link ClockService}. */
export type TimerHandle = { readonly id: number }

/** Wall time, monotonic time, the local date, and timers. */
export interface ClockService {
  /** Epoch milliseconds, like `Date.now()`. */
  now(): number
  /** Monotonic milliseconds, like `performance.now()`. */
  monotonicNow(): number
  /** The local calendar date as `YYYY-MM-DD`. */
  today(): string
  /** Calls `listener` with the new date whenever the local date changes. */
  subscribeToday(listener: (today: string) => void): () => void
  setTimeout(fn: () => void, ms: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
  setInterval(fn: () => void, ms: number): TimerHandle
  clearInterval(handle: TimerHandle): void
  sleep(ms: number): Promise<void>
}

const HEARTBEAT_MS = 60_000
const MIDNIGHT_PAD_MS = 250

/** The clock backed by the platform's `Date`, `performance`, and timers. */
export function createSystemClock(): ClockService {
  const timers = new Map<number, ReturnType<typeof globalThis.setTimeout>>()
  let nextId = 1

  let today = todayIso()
  const listeners = new Set<(today: string) => void>()
  let midnightTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let heartbeat: ReturnType<typeof globalThis.setInterval> | null = null

  const syncToday = (): void => {
    const next = todayIso()
    if (next === today) {
      return
    }
    today = next
    for (const listener of listeners) {
      listener(next)
    }
  }

  // DOM timers pause while the machine sleeps, so the heartbeat and the
  // visibility listener catch a midnight that this timer misses.
  const scheduleMidnightRollover = (): void => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setDate(midnight.getDate() + 1)
    midnight.setHours(0, 0, 0, 0)
    midnightTimer = globalThis.setTimeout(
      () => {
        syncToday()
        scheduleMidnightRollover()
      },
      midnight.getTime() - now.getTime() + MIDNIGHT_PAD_MS,
    )
  }

  const start = (): void => {
    syncToday()
    scheduleMidnightRollover()
    heartbeat = globalThis.setInterval(syncToday, HEARTBEAT_MS)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', syncToday)
    }
  }

  const stop = (): void => {
    if (midnightTimer !== null) {
      globalThis.clearTimeout(midnightTimer)
      midnightTimer = null
    }
    if (heartbeat !== null) {
      globalThis.clearInterval(heartbeat)
      heartbeat = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', syncToday)
    }
  }

  const clearTimer = (handle: TimerHandle): void => {
    const timer = timers.get(handle.id)
    if (timer === undefined) {
      return
    }
    timers.delete(handle.id)
    globalThis.clearTimeout(timer)
  }

  const clock: ClockService = {
    now: () => Date.now(),
    monotonicNow: () => performance.now(),
    today() {
      // While nothing is subscribed, no timer keeps the cached date fresh.
      if (listeners.size === 0) {
        today = todayIso()
      }
      return today
    },
    subscribeToday(listener) {
      const first = listeners.size === 0
      listeners.add(listener)
      if (first) {
        start()
      }
      return () => {
        if (!listeners.delete(listener)) {
          return
        }
        if (listeners.size === 0) {
          stop()
        }
      }
    },
    setTimeout(fn, ms) {
      const id = nextId++
      timers.set(
        id,
        globalThis.setTimeout(() => {
          timers.delete(id)
          fn()
        }, ms),
      )
      return { id }
    },
    clearTimeout: clearTimer,
    setInterval(fn, ms) {
      const id = nextId++
      timers.set(id, globalThis.setInterval(fn, ms))
      return { id }
    },
    clearInterval: clearTimer,
    sleep(ms) {
      return new Promise((resolve) => {
        clock.setTimeout(resolve, ms)
      })
    },
  }
  return clock
}

let defaultClockInstance: ClockService | null = null

/** The process-wide clock; a system clock unless {@link setDefaultClock} installed another. */
export function defaultClock(): ClockService {
  defaultClockInstance ??= createSystemClock()
  return defaultClockInstance
}

/** Installs the process-wide clock; `null` restores a lazily created system clock. */
export function setDefaultClock(clock: ClockService | null): void {
  defaultClockInstance = clock
}
