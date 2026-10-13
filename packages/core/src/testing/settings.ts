import type { OperationsService } from '../app/operations-service.ts'
import { ReflectError } from '../errors.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { Settings } from '../settings/schema.ts'
import {
  createSettingsService,
  type SettingsLoadOutcome,
  type SettingsService,
  type SettingsStatus,
} from '../settings/settings-service.ts'
import { createTestIpcBridgeService, type TestIpcBridgeService } from './ipc.ts'
import { createTestOperationsService } from './operations.ts'

/**
 * The real {@link SettingsService} over an in-memory settings document.
 */
export interface TestSettingsService extends SettingsService {
  /**
   * Answers `settings_load` and `settings_save`; register handlers to gate them.
   */
  readonly ipc: TestIpcBridgeService
  readonly operations: OperationsService
  /**
   * Every document a save persisted, oldest first.
   */
  saves(): Settings[]
  /**
   * Makes the next `settings_save` reject with an `io` error.
   */
  failNextSave(): void
  /**
   * Makes the load reject with an `io` error. Call before the first read.
   */
  failLoad(): void
  /**
   * Merges `patch` into the stored document. Throws once the load has read it.
   */
  seed(patch: Partial<Settings>): void
}

class TestSettingsServiceImpl implements TestSettingsService {
  readonly ipc: TestIpcBridgeService
  readonly operations: OperationsService
  readonly #inner: SettingsService
  readonly #saved: Settings[] = []
  #stored: Partial<Settings>
  #loadStarted = false
  #failSave = false
  #loadFails = false

  constructor(initial: Partial<Settings> | undefined, operations: OperationsService) {
    this.#stored = { ...initial }
    this.operations = operations
    this.ipc = createTestIpcBridgeService({
      commands: {
        settings_load: () => {
          this.#loadStarted = true
          if (this.#loadFails) {
            throw new ReflectError('io', 'test settings: load failed')
          }
          return this.#saved.at(-1) ?? { ...this.#stored }
        },
        settings_save: (args) => {
          if (this.#failSave) {
            this.#failSave = false
            throw new ReflectError('io', 'test settings: save failed')
          }
          this.#saved.push(args['settings'] as Settings)
          return null
        },
      },
    })
    this.#inner = createSettingsService({ ipc: this.ipc, operations })
  }

  readonly get = (): Settings => this.#inner.get()

  readonly subscribe = (listener: () => void): Unlisten => this.#inner.subscribe(listener)

  readonly update = (patch: Partial<Settings>): void => {
    this.#inner.update(patch)
  }

  readonly updateWith = (updater: (current: Settings) => Partial<Settings>): void => {
    this.#inner.updateWith(updater)
  }

  readonly whenLoaded = (): Promise<SettingsLoadOutcome> => this.#inner.whenLoaded()

  readonly reload = (): Promise<SettingsLoadOutcome> => this.#inner.reload()

  readonly flush = (): Promise<void> => this.#inner.flush()

  readonly status = (): SettingsStatus => this.#inner.status()

  saves(): Settings[] {
    return [...this.#saved]
  }

  failNextSave(): void {
    this.#failSave = true
  }

  failLoad(): void {
    this.#loadFails = true
  }

  seed(patch: Partial<Settings>): void {
    if (this.#loadStarted) {
      throw new Error('test settings: seed() must come before the first read')
    }
    this.#stored = { ...this.#stored, ...patch }
  }
}

/**
 * A {@link SettingsService} whose stored document starts as `initial`. The
 * load starts at the first read, so `failLoad()` and handler overrides must
 * come before it.
 */
export function createTestSettingsService(
  initial?: Partial<Settings>,
  deps?: { operations?: OperationsService | undefined },
): TestSettingsService {
  return new TestSettingsServiceImpl(initial, deps?.operations ?? createTestOperationsService())
}
