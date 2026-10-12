import type { OperationsService } from '../app/operations-service.ts'
import { ReflectError } from '../errors.ts'
import type { Settings } from '../settings/schema.ts'
import { createSettingsService, type SettingsService } from '../settings/settings-service.ts'
import { createTestIpcBridgeService, type TestIpcBridgeService } from './ipc.ts'
import { createTestOperationsService } from './operations.ts'

/** The real {@link SettingsService} over an in-memory settings document. */
export interface TestSettingsService extends SettingsService {
  /** Answers `settings_load` and `settings_save`; register handlers to gate them. */
  readonly ipc: TestIpcBridgeService
  readonly operations: OperationsService
  /** Every document a save persisted, oldest first. */
  saves(): Settings[]
  /** Makes the next `settings_save` reject with an `io` error. */
  failNextSave(): void
  /** Makes the load reject with an `io` error. Call before the first read. */
  failLoad(): void
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
  const operations = deps?.operations ?? createTestOperationsService()
  const saved: Settings[] = []
  let failSave = false
  let loadFails = false
  const ipc = createTestIpcBridgeService({
    commands: {
      settings_load: () => {
        if (loadFails) {
          throw new ReflectError('io', 'test settings: load failed')
        }
        return saved.at(-1) ?? { ...initial }
      },
      settings_save: (args) => {
        if (failSave) {
          failSave = false
          throw new ReflectError('io', 'test settings: save failed')
        }
        saved.push(args['settings'] as Settings)
        return null
      },
    },
  })
  const service = createSettingsService({ ipc, operations })
  return {
    ...service,
    ipc,
    operations,
    saves: () => [...saved],
    failNextSave() {
      failSave = true
    },
    failLoad() {
      loadFails = true
    },
  }
}
