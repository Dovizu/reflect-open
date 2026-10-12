import type { Unlisten } from '../ipc/ipc-service.ts'

/**
 * The software keyboard's overlap height, as the UI last measured it.
 * Imperative consumers read {@link KeyboardService.getHeight} (a swipe guard
 * fires at drag start, outside any render); reactive ones subscribe. Members
 * are function properties so surfaces can pass them around unbound.
 */
export interface KeyboardService {
  /** The last published keyboard overlap in px: `0` when the keyboard is closed. */
  getHeight: () => number
  /** Whether the software keyboard is up. */
  isVisible: () => boolean
  /** Listen for a changed height. */
  subscribe: (listener: () => void) => Unlisten
  /** Record the keyboard overlap height. A height equal to the current one notifies nobody. */
  publish: (height: number) => void
}

export function createKeyboardService(): KeyboardService {
  let currentHeight = 0
  const listeners = new Set<() => void>()

  return {
    getHeight: () => currentHeight,
    isVisible: () => currentHeight > 0,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    publish: (height) => {
      if (height === currentHeight) {
        return
      }
      currentHeight = height
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

let defaultService: KeyboardService | null = null

/** The process-wide `KeyboardService`; a fresh one unless replaced. */
export function defaultKeyboard(): KeyboardService {
  defaultService ??= createKeyboardService()
  return defaultService
}

/** Install the process-wide `KeyboardService`; `null` restores a fresh one. */
export function setDefaultKeyboard(service: KeyboardService | null): void {
  defaultService = service
}
