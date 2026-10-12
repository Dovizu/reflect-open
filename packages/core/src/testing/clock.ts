import type { ClockService, TimerHandle } from '../app/clock-service.ts'
import { localIsoDate } from '../lib/dates.ts'

/** A {@link ClockService} whose time moves only when a test moves it. */
export interface TestClockService extends ClockService {
  /** Moves time forward by `ms`, running due timers in order and settling promises between them. */
  advance(ms: number): Promise<void>
  /** Sets the wall clock without running timers or moving the monotonic clock. */
  setNow(epochMs: number): void
  /** Pins `today()` to `isoDate` and notifies `subscribeToday` listeners. */
  setToday(isoDate: string): void
  /** The number of scheduled timeouts and intervals. */
  pendingTimers(): number
}

interface ScheduledTimer {
  readonly fn: () => void
  readonly interval: number | null
  due: number
  order: number
}

const MICROTASK_TURNS = 20

async function settle(): Promise<void> {
  for (let turn = 0; turn < MICROTASK_TURNS; turn++) {
    await Promise.resolve()
  }
}

/**
 * Without `today`, `today()` follows the local date of `now()`. `setToday`
 * pins it until the next `setToday`.
 */
export function createTestClockService(options?: {
  now?: number
  today?: string
}): TestClockService {
  let wallMs = options?.now ?? 0
  let monotonicMs = 0
  let pinnedToday: string | null = options?.today ?? null
  const listeners = new Set<(today: string) => void>()
  const timers = new Map<number, ScheduledTimer>()
  let nextId = 1
  let nextOrder = 0

  const currentToday = (): string => pinnedToday ?? localIsoDate(new Date(wallMs))
  let lastToday = currentToday()

  const notifyToday = (): void => {
    const next = currentToday()
    if (next === lastToday) {
      return
    }
    lastToday = next
    for (const listener of listeners) {
      listener(next)
    }
  }

  const schedule = (fn: () => void, ms: number, interval: number | null): TimerHandle => {
    const id = nextId++
    timers.set(id, { fn, interval, due: monotonicMs + Math.max(0, ms), order: nextOrder++ })
    return { id }
  }

  const clearTimer = (handle: TimerHandle): void => {
    timers.delete(handle.id)
  }

  const nextDue = (limit: number): [number, ScheduledTimer] | null => {
    let found: [number, ScheduledTimer] | null = null
    for (const entry of timers) {
      const timer = entry[1]
      if (timer.due > limit) {
        continue
      }
      if (
        found === null ||
        timer.due < found[1].due ||
        (timer.due === found[1].due && timer.order < found[1].order)
      ) {
        found = entry
      }
    }
    return found
  }

  const moveTo = (monotonicTarget: number): void => {
    wallMs += monotonicTarget - monotonicMs
    monotonicMs = monotonicTarget
    notifyToday()
  }

  const clock: TestClockService = {
    now: () => wallMs,
    monotonicNow: () => monotonicMs,
    today: currentToday,
    subscribeToday(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setTimeout: (fn, ms) => schedule(fn, ms, null),
    clearTimeout: clearTimer,
    // A zero period would never let `advance` finish.
    setInterval: (fn, ms) => schedule(fn, ms, Math.max(1, ms)),
    clearInterval: clearTimer,
    sleep(ms) {
      return new Promise((resolve) => {
        clock.setTimeout(resolve, ms)
      })
    },
    async advance(ms) {
      const target = monotonicMs + Math.max(0, ms)
      await settle()
      for (let next = nextDue(target); next !== null; next = nextDue(target)) {
        const [id, timer] = next
        moveTo(timer.due)
        if (timer.interval === null) {
          timers.delete(id)
        } else {
          timer.due += timer.interval
          timer.order = nextOrder++
        }
        timer.fn()
        await settle()
      }
      moveTo(target)
      await settle()
    },
    setNow(epochMs) {
      wallMs = epochMs
      notifyToday()
    },
    setToday(isoDate) {
      pinnedToday = isoDate
      notifyToday()
    },
    pendingTimers: () => timers.size,
  }
  return clock
}
