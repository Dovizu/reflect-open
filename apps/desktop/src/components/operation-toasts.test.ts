import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultOperations } from '@reflect/core'
import { createTestOperationsService, type TestOperationsService } from '@reflect/core/testing'
import { startOperation } from '@/lib/operations.ts'
import type { MockToastAddOptions } from '@/test-utils/toast.ts'
import { attachOperationToasts } from './operation-toasts.ts'

const toast = vi.hoisted(() => ({
  add: vi.fn<(options: MockToastAddOptions) => string>(),
  close: vi.fn(),
}))

vi.mock('@/components/ui/toast.tsx', () => ({ toast }))

let detach: () => void = () => {}
let operations: TestOperationsService

beforeEach(() => {
  operations = createTestOperationsService()
  setDefaultOperations(operations)
  toast.add.mockClear()
  toast.close.mockClear()
  detach = attachOperationToasts()
})

afterEach(() => {
  detach()
  setDefaultOperations(null)
})

describe('attachOperationToasts', () => {
  it('creates and updates a toast with a stable operation id', () => {
    const handle = startOperation('Rebuilding search index')

    expect(toast.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'operation-1', title: 'Rebuilding search index' }),
    )

    handle.progress(3, 12)

    expect(toast.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'operation-1', description: '3/12' }),
    )
  })

  it('surfaces failures and closes the toast when the operation clears', async () => {
    const handle = startOperation('Saving settings')
    handle.fail('disk full')

    expect(toast.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'operation-1', description: 'disk full', type: 'error' }),
    )

    await operations.clock.advance(9_200)
    expect(toast.close).toHaveBeenCalledWith('operation-1')
  })

  it('passes optional action metadata to the toast', () => {
    const run = vi.fn()

    startOperation('Update available', { action: { label: 'Install', run }, persistent: true })

    expect(toast.add).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'operation-1',
        timeout: 0,
        data: { dismissible: false },
        actionProps: expect.objectContaining({ children: 'Install' }),
      }),
    )

    const options = toast.add.mock.lastCall?.[0]
    options?.actionProps?.onClick()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('does not remove the operation when a toast is dismissed', () => {
    const handle = startOperation('Saving settings')

    expect(toast.add).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ onClose: expect.any(Function) }),
    )

    handle.fail('disk full')

    expect(toast.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'operation-1', description: 'disk full', type: 'error' }),
    )
  })

  it('consumes rejected action promises', async () => {
    const error = new Error('network down')
    const run = vi.fn(async () => {
      throw error
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    startOperation('Update available', { action: { label: 'Install', run } })

    const options = toast.add.mock.lastCall?.[0]
    options?.actionProps?.onClick()
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('operation action failed:', error),
    )

    consoleError.mockRestore()
  })
})
