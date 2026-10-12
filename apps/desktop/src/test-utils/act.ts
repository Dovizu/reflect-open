import { act as reactAct } from 'react'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

/**
 * React's `act` for browser tests. React only accepts `act` while
 * `IS_REACT_ACT_ENVIRONMENT` is set, and the flag cannot stay on: with it on,
 * every update from a real browser event warns that it was not wrapped in
 * `act`. So the flag is on for the duration of the scope only, the same rule
 * `vitest-browser-react` applies to its own `render`.
 *
 * Tests import this instead of `act` from `react`.
 */
export function act(callback: () => void | undefined): void
export function act<T>(callback: () => T | Promise<T>): Promise<T>
export function act<T>(callback: () => T | Promise<T>): void | Promise<T> {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT
  const restore = (): void => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous
  }
  const scope = { isAsync: false }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let result: PromiseLike<T>
  try {
    result = reactAct((): Promise<T> => {
      const returned = callback()
      scope.isAsync = returned instanceof Promise
      return returned as Promise<T>
    })
  } catch (error) {
    restore()
    throw error
  }
  if (scope.isAsync) {
    return Promise.resolve(result).finally(restore)
  }
  // A synchronous scope: React has flushed the work before it returns. A
  // caller that awaits the result anyway makes React flush once more, so the
  // flag is on again for that flush.
  restore()
  const awaited: PromiseLike<T> = {
    then: (onFulfilled, onRejected) => {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true
      return Promise.resolve(result).finally(restore).then(onFulfilled, onRejected)
    },
  }
  return awaited as Promise<T>
}
