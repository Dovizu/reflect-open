import type { ClipboardService } from '../app/clipboard-service.ts'
import type { DialogService, PickFilesOptions, PickFolderOptions } from '../app/dialog-service.ts'
import type { AppLifecycleService, BackgroundTaskToken } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import { createOpenerService, type OpenerService } from '../app/opener-service.ts'
import {
  MAIN_WINDOW_LABEL,
  type CloseRequestedHandler,
  type WindowService,
} from '../app/window-service.ts'
import type { WindowBootstrap } from '../graph/schemas.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import { createTestLoggerService } from './logger.ts'

type Listener<Args extends unknown[] = []> = (...args: Args) => void

function createListeners<Args extends unknown[] = []>(): {
  add(listener: Listener<Args>): Unlisten
  emit(...args: Args): void
} {
  const listeners = new Set<Listener<Args>>()
  return {
    add(listener) {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver: Listener<Args> = (...args) => {
        listener(...args)
      }
      listeners.add(deliver)
      return () => {
        listeners.delete(deliver)
      }
    },
    emit(...args) {
      for (const listener of listeners) {
        listener(...args)
      }
    },
  }
}

export type DialogCall =
  | { readonly kind: 'files'; readonly options: PickFilesOptions }
  | { readonly kind: 'folder'; readonly options: PickFolderOptions }

export interface TestDialogService extends DialogService {
  /** What the next file pickers return; `null` reads as a cancel. */
  setFiles(files: readonly string[] | null): void
  /** What the next folder pickers return; `null` reads as a cancel. */
  setFolder(folder: string | null): void
  calls(): readonly DialogCall[]
}

/** A {@link DialogService} that answers every picker with preset paths. Defaults to cancel. */
export function createTestDialogService(options?: {
  files?: readonly string[] | null
  folder?: string | null
}): TestDialogService {
  let files = options?.files ?? null
  let folder = options?.folder ?? null
  const log: DialogCall[] = []
  return {
    pickFiles: async (pickOptions) => {
      log.push({ kind: 'files', options: pickOptions })
      return files
    },
    pickFolder: async (pickOptions) => {
      log.push({ kind: 'folder', options: pickOptions })
      return folder
    },
    setFiles(next) {
      files = next
    },
    setFolder(next) {
      folder = next
    },
    calls: () => [...log],
  }
}

export interface TestClipboardService extends ClipboardService {
  writes(): readonly string[]
  /** Make later writes reject with `error`; `null` makes them succeed again. */
  failWith(error: unknown): void
}

/** A {@link ClipboardService} that records every write. */
export function createTestClipboardService(): TestClipboardService {
  const written: string[] = []
  let failure: { error: unknown } | null = null
  return {
    writeText: async (text) => {
      if (failure !== null) {
        throw failure.error
      }
      written.push(text)
    },
    writes: () => [...written],
    failWith(error) {
      failure = error === null ? null : { error }
    },
  }
}

export interface TestOpenerService extends OpenerService {
  openedUrls(): readonly string[]
  revealedPaths(): readonly string[]
  /** Make later opens and reveals reject with `error`; `null` makes them succeed again. */
  failWith(error: unknown): void
}

/** An {@link OpenerService} that records every URL and path instead of opening it. */
export function createTestOpenerService(options?: { logger?: LoggerService }): TestOpenerService {
  const opened: string[] = []
  const revealed: string[] = []
  let failure: { error: unknown } | null = null
  const service = createOpenerService({
    transport: {
      openUrl: async (url) => {
        if (failure !== null) {
          throw failure.error
        }
        opened.push(url)
      },
      revealItemInDir: async (path) => {
        if (failure !== null) {
          throw failure.error
        }
        revealed.push(path)
      },
    },
    logger: options?.logger ?? createTestLoggerService(),
  })
  return {
    ...service,
    openedUrls: () => [...opened],
    revealedPaths: () => [...revealed],
    failWith(error) {
      failure = error === null ? null : { error }
    },
  }
}

export interface TestWindowService extends WindowService {
  openedNoteWindows(): readonly string[]
  closeSecondaryWindowsCalls(): number
  /** The last title set, or `null`. */
  title(): string | null
  emitNavigate(url: string): void
  emitIndexWritten(): void
  /** Deliver an event to {@link WindowService.subscribeWindowEvent} listeners. */
  emitWindowEvent(event: string, payload: unknown): void
  emitted(): readonly { label: string; event: string; payload: unknown }[]
  setFocusedWindowLabel(label: string | null): void
  /** Run the close-requested handlers; reports whether one prevented the close. */
  requestClose(): Promise<{ prevented: boolean }>
  hidden(): boolean
  devtoolsToggles(): number
}

/** An in-memory {@link WindowService}. `openNoteWindow` answers `true` unless `openNoteWindow` says otherwise. */
export function createTestWindowService(options?: {
  label?: string
  bootstrap?: WindowBootstrap
  openNoteWindow?: (deepLink: string) => boolean | Promise<boolean>
}): TestWindowService {
  const label = options?.label ?? MAIN_WINDOW_LABEL
  const opened: string[] = []
  const emittedEvents: { label: string; event: string; payload: unknown }[] = []
  const navigate = createListeners<[url: string]>()
  const indexWritten = createListeners()
  const windowEvents = new Map<string, ReturnType<typeof createListeners<[payload: unknown]>>>()
  const closeHandlers = new Set<CloseRequestedHandler>()
  let closeCalls = 0
  let currentTitle: string | null = null
  let focused: string | null = label
  let isHidden = false
  let toggles = 0

  return {
    label,
    isMainWindow: () => label === MAIN_WINDOW_LABEL,
    setTitle(title) {
      currentTitle = title
    },
    async openNoteWindow(deepLink) {
      opened.push(deepLink)
      return (await options?.openNoteWindow?.(deepLink)) ?? true
    },
    async closeSecondaryWindows() {
      closeCalls += 1
    },
    async bootstrap() {
      if (options?.bootstrap === undefined) {
        throw new Error('test window: no bootstrap configured')
      }
      return options.bootstrap
    },
    subscribeNavigate: (listener) => navigate.add(listener),
    subscribeIndexWritten: (listener) => indexWritten.add(listener),
    subscribeWindowEvent(event, listener) {
      let listeners = windowEvents.get(event)
      if (listeners === undefined) {
        listeners = createListeners<[payload: unknown]>()
        windowEvents.set(event, listeners)
      }
      return listeners.add(listener)
    },
    focusedWindowLabel: async () => focused,
    async emitTo(target, event, payload) {
      emittedEvents.push({ label: target, event, payload })
    },
    onCloseRequested(handler) {
      closeHandlers.add(handler)
      return () => {
        closeHandlers.delete(handler)
      }
    },
    async hide() {
      isHidden = true
    },
    async toggleDevtools() {
      toggles += 1
    },
    openedNoteWindows: () => [...opened],
    closeSecondaryWindowsCalls: () => closeCalls,
    title: () => currentTitle,
    emitNavigate: (url) => {
      navigate.emit(url)
    },
    emitIndexWritten: () => {
      indexWritten.emit()
    },
    emitWindowEvent(event, payload) {
      windowEvents.get(event)?.emit(payload)
    },
    emitted: () => [...emittedEvents],
    setFocusedWindowLabel(next) {
      focused = next
    },
    async requestClose() {
      let prevented = false
      const event = {
        preventDefault: () => {
          prevented = true
        },
      }
      for (const handler of closeHandlers) {
        await handler(event)
      }
      return { prevented }
    },
    hidden: () => isHidden,
    devtoolsToggles: () => toggles,
  }
}

export interface TestLifecycleService extends AppLifecycleService {
  emitResume(): void
  emitWake(): void
  emitFocus(): void
  emitVisible(): void
  emitHidden(): void
  emitPageHide(): void
  emitBeforeUnload(): void
  emitQuitRequested(): void
  setHidden(hidden: boolean): void
  confirmQuitCalls(): number
  /** Every background task begun, in order. */
  backgroundTasks(): readonly { token: BackgroundTaskToken; ended: boolean }[]
}

/**
 * An {@link AppLifecycleService} driven by its `emit*` methods. `emitVisible`
 * and `emitHidden` also update {@link AppLifecycleService.isHidden}. Without
 * `backgroundTasks`, `beginBackgroundTask` resolves `null`.
 */
export function createTestLifecycleService(options?: {
  hidden?: boolean
  backgroundTasks?: boolean
}): TestLifecycleService {
  const resume = createListeners()
  const wake = createListeners()
  const focus = createListeners()
  const visible = createListeners()
  const hiddenListeners = createListeners()
  const pageHide = createListeners()
  const beforeUnload = createListeners()
  const quitRequested = createListeners()
  const tasks: { token: BackgroundTaskToken; ended: boolean }[] = []
  let isHidden = options?.hidden ?? false
  let confirmCalls = 0

  return {
    subscribeResume: (listener) => resume.add(listener),
    subscribeWake: (listener) => wake.add(listener),
    subscribeFocus: (listener) => focus.add(listener),
    subscribeVisible: (listener) => visible.add(listener),
    subscribeHidden: (listener) => hiddenListeners.add(listener),
    subscribePageHide: (listener) => pageHide.add(listener),
    subscribeBeforeUnload: (listener) => beforeUnload.add(listener),
    isHidden: () => isHidden,
    subscribeQuitRequested: (listener) => quitRequested.add(listener),
    async confirmQuit() {
      confirmCalls += 1
    },
    async beginBackgroundTask() {
      if (!(options?.backgroundTasks ?? false)) {
        return null
      }
      const token = `background-task-${tasks.length + 1}`
      tasks.push({ token, ended: false })
      return token
    },
    async endBackgroundTask(token) {
      const task = tasks.find((entry) => entry.token === token)
      if (task !== undefined) {
        task.ended = true
      }
    },
    emitResume: () => {
      resume.emit()
    },
    emitWake: () => {
      wake.emit()
    },
    emitFocus: () => {
      focus.emit()
    },
    emitVisible() {
      isHidden = false
      visible.emit()
    },
    emitHidden() {
      isHidden = true
      hiddenListeners.emit()
    },
    emitPageHide: () => {
      pageHide.emit()
    },
    emitBeforeUnload: () => {
      beforeUnload.emit()
    },
    emitQuitRequested: () => {
      quitRequested.emit()
    },
    setHidden(next) {
      isHidden = next
    },
    confirmQuitCalls: () => confirmCalls,
    backgroundTasks: () => tasks.map((task) => ({ ...task })),
  }
}
