import { z } from 'zod'
import { currentIpc } from '../ipc/bridge.ts'
import { listenNow, type IpcBridgeService, type Unlisten } from '../ipc/ipc-service.ts'
import { defaultClock, type ClockService, type TimerHandle } from './clock-service.ts'
import { defaultLogger, type LoggerService } from './logger-service.ts'

/** The shell's notice that it deferred an app exit so the frontend can flush. */
export const QUIT_REQUESTED_EVENT = 'app:quit-requested'

/** The shortest gap between two resume callbacks of one subscription. */
export const RESUME_THROTTLE_MS = 1_500

const backgroundTaskTokenSchema = z.string()

/** Opaque handle for one finite-length native background execution assertion. */
export type BackgroundTaskToken = z.infer<typeof backgroundTaskTokenSchema>

/** The page events an {@link AppLifecycleService} observes. */
export type LifecyclePageEvent = 'focus' | 'online' | 'pagehide' | 'beforeunload'

/** The DOM behind an {@link AppLifecycleService}. */
export interface LifecycleDomAdapter {
  /** Add a listener for a window event; returns its remover. */
  onPageEvent(type: LifecyclePageEvent, listener: () => void): Unlisten
  /** Add a listener for document visibility changes; returns its remover. */
  onVisibilityChange(listener: () => void): Unlisten
  isHidden(): boolean
}

/** Application lifecycle signals and the shell's quit and background-task handshakes. */
export interface AppLifecycleService {
  /** Window focus, network back, or the page turning visible; throttled per subscription. */
  subscribeResume(listener: () => void): Unlisten
  /** Window focus or network back, unthrottled. */
  subscribeWake(listener: () => void): Unlisten
  subscribeVisible(listener: () => void): Unlisten
  subscribeHidden(listener: () => void): Unlisten
  subscribePageHide(listener: () => void): Unlisten
  subscribeBeforeUnload(listener: () => void): Unlisten
  isHidden(): boolean
  /** Listen for an exit the shell deferred until the frontend flushes. */
  subscribeQuitRequested(listener: () => void): Unlisten
  /** Confirm a deferred quit. The app exits inside this call, so the promise may never settle. */
  confirmQuit(): Promise<void>
  /** Ask the shell to keep running after the OS backgrounds the app; `null` when unavailable. */
  beginBackgroundTask(): Promise<BackgroundTaskToken | null>
  /** Balance {@link beginBackgroundTask}. Expired or repeated tokens are no-ops. */
  endBackgroundTask(token: BackgroundTaskToken): Promise<void>
}

export function createLifecycleService(deps: {
  ipc: IpcBridgeService
  dom: LifecycleDomAdapter
  clock: ClockService
  logger: LoggerService
}): AppLifecycleService {
  const { ipc, dom, clock, logger } = deps

  const subscribeWake = (listener: () => void): Unlisten => {
    const removeFocus = dom.onPageEvent('focus', listener)
    const removeOnline = dom.onPageEvent('online', listener)
    return () => {
      removeFocus()
      removeOnline()
    }
  }

  const subscribeVisibility = (visible: boolean, listener: () => void): Unlisten =>
    dom.onVisibilityChange(() => {
      if (dom.isHidden() !== visible) {
        listener()
      }
    })

  return {
    subscribeResume(listener) {
      let canceled = false
      let windowStart = -Infinity
      let timer: TimerHandle | null = null
      const fire = (): void => {
        windowStart = clock.now()
        listener()
      }
      // Leading and trailing: the first call fires, later calls in the window collapse into one.
      const handleResume = (): void => {
        if (canceled) {
          return
        }
        if (timer !== null) {
          clock.clearTimeout(timer)
          timer = null
        }
        const now = clock.now()
        if (now - windowStart >= RESUME_THROTTLE_MS) {
          fire()
          return
        }
        timer = clock.setTimeout(
          () => {
            timer = null
            fire()
          },
          RESUME_THROTTLE_MS + windowStart - now,
        )
      }
      const removeWake = subscribeWake(handleResume)
      const removeVisible = subscribeVisibility(true, handleResume)
      return () => {
        canceled = true
        if (timer !== null) {
          clock.clearTimeout(timer)
          timer = null
        }
        removeWake()
        removeVisible()
      }
    },
    subscribeWake,
    subscribeVisible: (listener) => subscribeVisibility(true, listener),
    subscribeHidden: (listener) => subscribeVisibility(false, listener),
    subscribePageHide: (listener) => dom.onPageEvent('pagehide', listener),
    subscribeBeforeUnload: (listener) => dom.onPageEvent('beforeunload', listener),
    isHidden: () => dom.isHidden(),
    subscribeQuitRequested: (listener) =>
      listenNow(
        () =>
          ipc.listen(QUIT_REQUESTED_EVENT, () => {
            listener()
          }),
        (cause) => {
          logger.error(`${QUIT_REQUESTED_EVENT} listener failed:`, cause)
        },
      ),
    confirmQuit: async () => {
      await ipc.call('quit_confirm', {}, z.null())
    },
    beginBackgroundTask: () =>
      ipc.call('background_task_begin', {}, backgroundTaskTokenSchema.nullable()),
    endBackgroundTask: async (token) => {
      await ipc.call('background_task_end', { token }, z.null())
    },
  }
}

/** A {@link LifecycleDomAdapter} with no page: no events, never hidden. */
export function createDetachedLifecycleDom(): LifecycleDomAdapter {
  return {
    onPageEvent: () => () => {},
    onVisibilityChange: () => () => {},
    isHidden: () => false,
  }
}

let defaultService: AppLifecycleService | null = null

/** The process-wide `AppLifecycleService`; one without DOM signals unless replaced. */
export function defaultLifecycle(): AppLifecycleService {
  defaultService ??= createLifecycleService({
    ipc: currentIpc(),
    dom: createDetachedLifecycleDom(),
    clock: defaultClock(),
    logger: defaultLogger(),
  })
  return defaultService
}

/** Install the process-wide `AppLifecycleService`; `null` restores the one without DOM signals. */
export function setDefaultLifecycle(service: AppLifecycleService | null): void {
  defaultService = service
}
