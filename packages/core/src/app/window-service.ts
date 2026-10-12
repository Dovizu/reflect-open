import { z } from 'zod'
import { errorMessage } from '../errors.ts'
import { windowBootstrapSchema, type WindowBootstrap } from '../graph/schemas.ts'
import { currentIpc } from '../ipc/bridge.ts'
import { listenNow, type IpcBridgeService, type Unlisten } from '../ipc/ipc-service.ts'
import { defaultLogger, type LoggerService } from './logger-service.ts'

/** The label of the window the app opens at launch. */
export const MAIN_WINDOW_LABEL = 'main'

/** The shell's `emit_to` request that a note window re-navigate to a `reflect://` link. */
export const WINDOW_NAVIGATE_EVENT = 'window:navigate'

/** The shell's broadcast after an index write command commits. */
export const INDEX_WRITTEN_EVENT = 'index:written'

/** The event passed to an {@link WindowService.onCloseRequested} handler. */
export interface CloseRequestedEvent {
  /** Keep the window open. Call it before the handler's first `await`. */
  preventDefault(): void
}

export type CloseRequestedHandler = (event: CloseRequestedEvent) => void | Promise<void>

/** The native window operations behind a {@link WindowService}. */
export interface WindowHost {
  /** This webview's window label. */
  readonly label: string
  /** True when the host can open secondary note windows. */
  readonly multiWindow: boolean
  setTitle(title: string): Promise<void>
  /** The label of the focused webview window, or `null` when none has focus. */
  focusedWindowLabel(): Promise<string | null>
  emitTo(label: string, event: string, payload: unknown): Promise<void>
  /** Listen for events addressed to this window. */
  listen(event: string, handler: (payload: unknown) => void): Promise<Unlisten>
  onCloseRequested(handler: CloseRequestedHandler): Promise<Unlisten>
  hide(): Promise<void>
}

/** Facts about this webview's window and the actions that span windows. */
export interface WindowService {
  readonly label: string
  isMainWindow(): boolean
  /** Set the OS window title. Best-effort: a failure is ignored. */
  setTitle(title: string): void
  /**
   * Open or focus a note window on a `reflect://` link. Concurrent calls for
   * one link share a request. False when the host has no secondary windows
   * or the command fails.
   */
  openNoteWindow(deepLink: string): Promise<boolean>
  /** Close every note window and wait for their flushes. Never rejects. */
  closeSecondaryWindows(): Promise<void>
  /** Adopt the main window's open graph and index sessions in a note window. */
  bootstrap(): Promise<WindowBootstrap>
  /** Listen for shell requests to re-navigate this window. */
  subscribeNavigate(listener: (url: string) => void): Unlisten
  /** Listen for committed index writes. */
  subscribeIndexWritten(listener: () => void): Unlisten
  /** Listen for an event that another window sent here with {@link emitTo}. */
  subscribeWindowEvent(event: string, listener: (payload: unknown) => void): Unlisten
  focusedWindowLabel(): Promise<string | null>
  emitTo(label: string, event: string, payload: unknown): Promise<void>
  onCloseRequested(handler: CloseRequestedHandler): Unlisten
  hide(): Promise<void>
  /** Open or close the native web inspector of this window. */
  toggleDevtools(): Promise<void>
}

export function createWindowService(deps: {
  ipc: IpcBridgeService
  host: WindowHost
  logger: LoggerService
}): WindowService {
  const { ipc, host, logger } = deps
  const pendingOpens = new Map<string, Promise<boolean>>()

  const track = (register: () => Promise<Unlisten>, what: string): Unlisten =>
    listenNow(register, (cause) => {
      logger.error(`${what} listener failed:`, cause)
    })

  const listenIpc = (event: string, handler: (payload: unknown) => void): Unlisten =>
    track(() => ipc.listen(event, handler), event)

  const open = async (deepLink: string): Promise<boolean> => {
    try {
      await ipc.call('open_note_window', { deepLink }, z.null())
      return true
    } catch (cause) {
      logger.error('open in new window failed:', errorMessage(cause))
      return false
    }
  }

  return {
    label: host.label,
    isMainWindow: () => host.label === MAIN_WINDOW_LABEL,
    setTitle(title) {
      host.setTitle(title).catch(() => {})
    },
    async openNoteWindow(deepLink) {
      if (!host.multiWindow) {
        return false
      }
      const pending = pendingOpens.get(deepLink)
      if (pending !== undefined) {
        return await pending
      }
      const opening = open(deepLink)
      pendingOpens.set(deepLink, opening)
      void opening.finally(() => {
        if (pendingOpens.get(deepLink) === opening) {
          pendingOpens.delete(deepLink)
        }
      })
      return await opening
    },
    async closeSecondaryWindows() {
      if (!host.multiWindow) {
        return
      }
      try {
        await ipc.call('close_note_windows', {}, z.null())
      } catch (cause) {
        logger.error('closing note windows failed:', errorMessage(cause))
      }
    },
    bootstrap: () => ipc.call('window_bootstrap', {}, windowBootstrapSchema),
    subscribeNavigate: (listener) =>
      listenIpc(WINDOW_NAVIGATE_EVENT, (payload) => {
        const parsed = z.string().safeParse(payload)
        if (parsed.success) {
          listener(parsed.data)
        } else {
          logger.error('invalid window:navigate payload:', parsed.error)
        }
      }),
    subscribeIndexWritten: (listener) =>
      listenIpc(INDEX_WRITTEN_EVENT, () => {
        listener()
      }),
    subscribeWindowEvent: (event, listener) => track(() => host.listen(event, listener), event),
    focusedWindowLabel: () => host.focusedWindowLabel(),
    emitTo: (label, event, payload) => host.emitTo(label, event, payload),
    onCloseRequested: (handler) => track(() => host.onCloseRequested(handler), 'close-requested'),
    hide: () => host.hide(),
    toggleDevtools: async () => {
      await ipc.call('toggle_devtools', {}, z.null())
    },
  }
}

/** The host of a single webview with no native windows: the main window. */
export function createSingleWindowHost(): WindowHost {
  return {
    label: MAIN_WINDOW_LABEL,
    multiWindow: false,
    setTitle: async () => {},
    focusedWindowLabel: async () => MAIN_WINDOW_LABEL,
    emitTo: async () => {},
    listen: async () => () => {},
    onCloseRequested: async () => () => {},
    hide: async () => {},
  }
}

let defaultService: WindowService | null = null

/** The process-wide `WindowService`; a single main window over the installed bridge unless replaced. */
export function defaultWindow(): WindowService {
  defaultService ??= createWindowService({
    ipc: currentIpc(),
    host: createSingleWindowHost(),
    logger: defaultLogger(),
  })
  return defaultService
}

/** Install the process-wide `WindowService`; `null` restores the single-window one. */
export function setDefaultWindow(service: WindowService | null): void {
  defaultService = service
}
