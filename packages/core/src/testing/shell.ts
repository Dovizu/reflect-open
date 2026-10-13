import type { ClipboardService } from '../app/clipboard-service.ts'
import type { DialogService, PickFilesOptions, PickFolderOptions } from '../app/dialog-service.ts'
import type { AppLifecycleService, BackgroundTaskToken } from '../app/lifecycle-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import {
  createOpenerService,
  type OpenerService,
  type SystemSettingsPane,
} from '../app/opener-service.ts'
import {
  MAIN_WINDOW_LABEL,
  type CloseRequestedHandler,
  type WindowService,
} from '../app/window-service.ts'
import type { WindowBootstrap } from '../graph/schemas.ts'
import type { Unlisten } from '../unlisten.ts'
import { createTestLoggerService } from './logger.ts'

type Listener<Args extends unknown[] = []> = (...args: Args) => void

class Listeners<Args extends unknown[] = []> {
  readonly #listeners = new Set<Listener<Args>>()

  add(listener: Listener<Args>): Unlisten {
    // Wrapped for identity, so one function added twice detaches independently.
    const deliver: Listener<Args> = (...args) => {
      listener(...args)
    }
    this.#listeners.add(deliver)
    return () => {
      this.#listeners.delete(deliver)
    }
  }

  emit(...args: Args): void {
    for (const listener of this.#listeners) {
      listener(...args)
    }
  }
}

export type DialogCall =
  | { readonly kind: 'files'; readonly options: PickFilesOptions }
  | { readonly kind: 'folder'; readonly options: PickFolderOptions }

export interface TestDialogService extends DialogService {
  /**
   * What the next file pickers return; `null` reads as a cancel.
   */
  setFiles(files: readonly string[] | null): void
  /**
   * What the next folder pickers return; `null` reads as a cancel.
   */
  setFolder(folder: string | null): void
  calls(): readonly DialogCall[]
}

class TestDialogServiceImpl implements TestDialogService {
  #files: readonly string[] | null
  #folder: string | null
  readonly #log: DialogCall[] = []

  constructor(files: readonly string[] | null, folder: string | null) {
    this.#files = files
    this.#folder = folder
  }

  async pickFiles(options: PickFilesOptions): Promise<readonly string[] | null> {
    this.#log.push({ kind: 'files', options })
    return this.#files
  }

  async pickFolder(options: PickFolderOptions): Promise<string | null> {
    this.#log.push({ kind: 'folder', options })
    return this.#folder
  }

  setFiles(files: readonly string[] | null): void {
    this.#files = files
  }

  setFolder(folder: string | null): void {
    this.#folder = folder
  }

  calls(): readonly DialogCall[] {
    return [...this.#log]
  }
}

/**
 * A {@link DialogService} that answers every picker with preset paths.
 * Defaults to cancel.
 */
export function createTestDialogService(options?: {
  files?: readonly string[] | null
  folder?: string | null
}): TestDialogService {
  return new TestDialogServiceImpl(options?.files ?? null, options?.folder ?? null)
}

export interface TestClipboardService extends ClipboardService {
  writes(): readonly string[]
  /**
   * Make later writes reject with `error`; `null` makes them succeed again.
   */
  failWith(error: unknown): void
}

class TestClipboardServiceImpl implements TestClipboardService {
  readonly #written: string[] = []
  #failure: { error: unknown } | null = null

  async writeText(text: string): Promise<void> {
    if (this.#failure !== null) {
      throw this.#failure.error
    }
    this.#written.push(text)
  }

  writes(): readonly string[] {
    return [...this.#written]
  }

  failWith(error: unknown): void {
    this.#failure = error === null ? null : { error }
  }
}

/**
 * A {@link ClipboardService} that records every write.
 */
export function createTestClipboardService(): TestClipboardService {
  return new TestClipboardServiceImpl()
}

export interface TestOpenerService extends OpenerService {
  openedUrls(): readonly string[]
  revealedPaths(): readonly string[]
  /**
   * Make later opens and reveals reject with `error`; `null` makes them succeed again.
   */
  failWith(error: unknown): void
}

/**
 * Forwards every member to the real service, over a transport that records.
 */
class TestOpenerServiceImpl implements TestOpenerService {
  readonly #inner: OpenerService
  readonly #opened: string[] = []
  readonly #revealed: string[] = []
  #failure: { error: unknown } | null = null

  constructor(logger: LoggerService) {
    this.#inner = createOpenerService({
      transport: {
        openUrl: async (url) => {
          if (this.#failure !== null) {
            throw this.#failure.error
          }
          this.#opened.push(url)
        },
        revealItemInDir: async (path) => {
          if (this.#failure !== null) {
            throw this.#failure.error
          }
          this.#revealed.push(path)
        },
      },
      logger,
    })
  }

  openUrl(url: string): Promise<void> {
    return this.#inner.openUrl(url)
  }

  openUrlSync(url: string): void {
    this.#inner.openUrlSync(url)
  }

  revealInFileManager(path: string): Promise<void> {
    return this.#inner.revealInFileManager(path)
  }

  openSystemSettings(pane: SystemSettingsPane): void {
    this.#inner.openSystemSettings(pane)
  }

  openedUrls(): readonly string[] {
    return [...this.#opened]
  }

  revealedPaths(): readonly string[] {
    return [...this.#revealed]
  }

  failWith(error: unknown): void {
    this.#failure = error === null ? null : { error }
  }
}

/**
 * An {@link OpenerService} that records every URL and path instead of opening it.
 */
export function createTestOpenerService(options?: { logger?: LoggerService }): TestOpenerService {
  return new TestOpenerServiceImpl(options?.logger ?? createTestLoggerService())
}

export interface TestWindowService extends WindowService {
  openedNoteWindows(): readonly string[]
  closeSecondaryWindowsCalls(): number
  /**
   * The last title set, or `null`.
   */
  title(): string | null
  emitNavigate(url: string): void
  emitIndexWritten(): void
  /**
   * Deliver an event to {@link WindowService.subscribeWindowEvent} listeners.
   */
  emitWindowEvent(event: string, payload: unknown): void
  emitted(): readonly { label: string; event: string; payload: unknown }[]
  setFocusedWindowLabel(label: string | null): void
  /**
   * Run the close-requested handlers; reports whether one prevented the close.
   */
  requestClose(): Promise<{ prevented: boolean }>
  hidden(): boolean
  devtoolsToggles(): number
}

interface TestWindowServiceOptions {
  label?: string
  bootstrap?: WindowBootstrap
  openNoteWindow?: (deepLink: string) => boolean | Promise<boolean>
}

class TestWindowServiceImpl implements TestWindowService {
  readonly #options: TestWindowServiceOptions | undefined
  readonly #opened: string[] = []
  readonly #emittedEvents: { label: string; event: string; payload: unknown }[] = []
  readonly #navigate = new Listeners<[url: string]>()
  readonly #indexWritten = new Listeners()
  readonly #windowEvents = new Map<string, Listeners<[payload: unknown]>>()
  readonly #closeHandlers = new Set<CloseRequestedHandler>()
  #closeCalls = 0
  #currentTitle: string | null = null
  #focused: string | null
  #isHidden = false
  #toggles = 0

  readonly label: string

  constructor(options: TestWindowServiceOptions | undefined) {
    this.#options = options
    this.label = options?.label ?? MAIN_WINDOW_LABEL
    this.#focused = this.label
  }

  isMainWindow(): boolean {
    return this.label === MAIN_WINDOW_LABEL
  }

  setTitle(title: string): void {
    this.#currentTitle = title
  }

  async openNoteWindow(deepLink: string): Promise<boolean> {
    this.#opened.push(deepLink)
    return (await this.#options?.openNoteWindow?.(deepLink)) ?? true
  }

  async closeSecondaryWindows(): Promise<void> {
    this.#closeCalls += 1
  }

  async bootstrap(): Promise<WindowBootstrap> {
    if (this.#options?.bootstrap === undefined) {
      throw new Error('test window: no bootstrap configured')
    }
    return this.#options.bootstrap
  }

  subscribeNavigate(listener: (url: string) => void): Unlisten {
    return this.#navigate.add(listener)
  }

  subscribeIndexWritten(listener: () => void): Unlisten {
    return this.#indexWritten.add(listener)
  }

  subscribeWindowEvent(event: string, listener: (payload: unknown) => void): Unlisten {
    let listeners = this.#windowEvents.get(event)
    if (listeners === undefined) {
      listeners = new Listeners<[payload: unknown]>()
      this.#windowEvents.set(event, listeners)
    }
    return listeners.add(listener)
  }

  async focusedWindowLabel(): Promise<string | null> {
    return this.#focused
  }

  async emitTo(target: string, event: string, payload: unknown): Promise<void> {
    this.#emittedEvents.push({ label: target, event, payload })
  }

  onCloseRequested(handler: CloseRequestedHandler): Unlisten {
    this.#closeHandlers.add(handler)
    return () => {
      this.#closeHandlers.delete(handler)
    }
  }

  async hide(): Promise<void> {
    this.#isHidden = true
  }

  async toggleDevtools(): Promise<void> {
    this.#toggles += 1
  }

  openedNoteWindows(): readonly string[] {
    return [...this.#opened]
  }

  closeSecondaryWindowsCalls(): number {
    return this.#closeCalls
  }

  title(): string | null {
    return this.#currentTitle
  }

  emitNavigate(url: string): void {
    this.#navigate.emit(url)
  }

  emitIndexWritten(): void {
    this.#indexWritten.emit()
  }

  emitWindowEvent(event: string, payload: unknown): void {
    this.#windowEvents.get(event)?.emit(payload)
  }

  emitted(): readonly { label: string; event: string; payload: unknown }[] {
    return [...this.#emittedEvents]
  }

  setFocusedWindowLabel(label: string | null): void {
    this.#focused = label
  }

  async requestClose(): Promise<{ prevented: boolean }> {
    let prevented = false
    const event = {
      preventDefault: () => {
        prevented = true
      },
    }
    for (const handler of this.#closeHandlers) {
      await handler(event)
    }
    return { prevented }
  }

  hidden(): boolean {
    return this.#isHidden
  }

  devtoolsToggles(): number {
    return this.#toggles
  }
}

/**
 * An in-memory {@link WindowService}. `openNoteWindow` answers `true` unless
 * `options.openNoteWindow` says otherwise.
 */
export function createTestWindowService(options?: TestWindowServiceOptions): TestWindowService {
  return new TestWindowServiceImpl(options)
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
  /**
   * Every background task begun, in order.
   */
  backgroundTasks(): readonly { token: BackgroundTaskToken; ended: boolean }[]
}

interface TestLifecycleServiceOptions {
  hidden?: boolean
  backgroundTasks?: boolean
}

class TestLifecycleServiceImpl implements TestLifecycleService {
  readonly #options: TestLifecycleServiceOptions | undefined
  readonly #resume = new Listeners()
  readonly #wake = new Listeners()
  readonly #focus = new Listeners()
  readonly #visible = new Listeners()
  readonly #hiddenListeners = new Listeners()
  readonly #pageHide = new Listeners()
  readonly #beforeUnload = new Listeners()
  readonly #quitRequested = new Listeners()
  readonly #tasks: { token: BackgroundTaskToken; ended: boolean }[] = []
  #isHidden: boolean
  #confirmCalls = 0

  constructor(options: TestLifecycleServiceOptions | undefined) {
    this.#options = options
    this.#isHidden = options?.hidden ?? false
  }

  subscribeResume(listener: () => void): Unlisten {
    return this.#resume.add(listener)
  }

  subscribeWake(listener: () => void): Unlisten {
    return this.#wake.add(listener)
  }

  subscribeFocus(listener: () => void): Unlisten {
    return this.#focus.add(listener)
  }

  subscribeVisible(listener: () => void): Unlisten {
    return this.#visible.add(listener)
  }

  subscribeHidden(listener: () => void): Unlisten {
    return this.#hiddenListeners.add(listener)
  }

  subscribePageHide(listener: () => void): Unlisten {
    return this.#pageHide.add(listener)
  }

  subscribeBeforeUnload(listener: () => void): Unlisten {
    return this.#beforeUnload.add(listener)
  }

  isHidden(): boolean {
    return this.#isHidden
  }

  subscribeQuitRequested(listener: () => void): Unlisten {
    return this.#quitRequested.add(listener)
  }

  async confirmQuit(): Promise<void> {
    this.#confirmCalls += 1
  }

  async beginBackgroundTask(): Promise<BackgroundTaskToken | null> {
    if (!(this.#options?.backgroundTasks ?? false)) {
      return null
    }
    const token = `background-task-${this.#tasks.length + 1}`
    this.#tasks.push({ token, ended: false })
    return token
  }

  async endBackgroundTask(token: BackgroundTaskToken): Promise<void> {
    const task = this.#tasks.find((entry) => entry.token === token)
    if (task !== undefined) {
      task.ended = true
    }
  }

  emitResume(): void {
    this.#resume.emit()
  }

  emitWake(): void {
    this.#wake.emit()
  }

  emitFocus(): void {
    this.#focus.emit()
  }

  emitVisible(): void {
    this.#isHidden = false
    this.#visible.emit()
  }

  emitHidden(): void {
    this.#isHidden = true
    this.#hiddenListeners.emit()
  }

  emitPageHide(): void {
    this.#pageHide.emit()
  }

  emitBeforeUnload(): void {
    this.#beforeUnload.emit()
  }

  emitQuitRequested(): void {
    this.#quitRequested.emit()
  }

  setHidden(hidden: boolean): void {
    this.#isHidden = hidden
  }

  confirmQuitCalls(): number {
    return this.#confirmCalls
  }

  backgroundTasks(): readonly { token: BackgroundTaskToken; ended: boolean }[] {
    return this.#tasks.map((task) => ({ ...task }))
  }
}

/**
 * An {@link AppLifecycleService} driven by its `emit*` methods. `emitVisible`
 * and `emitHidden` also update {@link AppLifecycleService.isHidden}. Without
 * `backgroundTasks`, `beginBackgroundTask` resolves `null`.
 */
export function createTestLifecycleService(
  options?: TestLifecycleServiceOptions,
): TestLifecycleService {
  return new TestLifecycleServiceImpl(options)
}
