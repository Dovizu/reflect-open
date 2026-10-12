import {
  createOperationsService,
  type Operation,
  type OperationsService,
} from '../app/operations-service.ts'
import { createTestClockService, type TestClockService } from './clock.ts'

/** The real {@link OperationsService} over a test clock, plus lookup helpers. */
export interface TestOperationsService extends OperationsService {
  /** The clock that drives the minimum visible and linger timers. */
  readonly clock: TestClockService
  /** The newest current operation with `label`, if any. */
  findByLabel(label: string): Operation | undefined
  /** The current operations as plain values without ids or actions. */
  snapshot(): OperationSnapshot[]
}

export type OperationSnapshot = Omit<Operation, 'id' | 'action'> & {
  action: string | null
}

export function createTestOperationsService(clock?: TestClockService): TestOperationsService {
  const testClock = clock ?? createTestClockService()
  const service = createOperationsService({ clock: testClock })
  return {
    ...service,
    clock: testClock,
    findByLabel: (label) => service.getAll().findLast((operation) => operation.label === label),
    snapshot: () =>
      service.getAll().map(({ id: _id, action, ...rest }) => ({
        ...rest,
        action: action?.label ?? null,
      })),
  }
}
