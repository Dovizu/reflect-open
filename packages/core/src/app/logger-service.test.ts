import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestLoggerService } from '../testing/logger.ts'
import { createConsoleLogger } from './logger-service.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createConsoleLogger', () => {
  it('forwards each level to the matching console method', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createConsoleLogger()
    const cause = new Error('boom')

    logger.error('failed:', cause)
    logger.warn('careful', 42)
    logger.info('done', { count: 1 })

    expect(error).toHaveBeenCalledExactlyOnceWith('failed:', cause)
    expect(warn).toHaveBeenCalledExactlyOnceWith('careful', 42)
    expect(info).toHaveBeenCalledExactlyOnceWith('done', { count: 1 })
  })

  it('passes a message without a cause as a single argument', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    createConsoleLogger().error('only a message')

    expect(error.mock.calls).toEqual([['only a message']])
  })
})

describe('createTestLoggerService', () => {
  it('records entries per level', () => {
    const logger = createTestLoggerService()
    const cause = new Error('boom')

    logger.error('failed:', cause)
    logger.warn('careful')
    logger.info('done', 1)
    logger.info('again')

    expect(logger.getErrors()).toEqual([{ message: 'failed:', cause }])
    expect(logger.getWarnings()).toEqual([{ message: 'careful', cause: undefined }])
    expect(logger.getInfos()).toEqual([
      { message: 'done', cause: 1 },
      { message: 'again', cause: undefined },
    ])
  })

  it('never prints', () => {
    const error = vi.spyOn(console, 'error')
    const warn = vi.spyOn(console, 'warn')
    const info = vi.spyOn(console, 'info')
    const logger = createTestLoggerService()

    logger.error('a')
    logger.warn('b')
    logger.info('c')

    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
  })

  it('returns snapshots that later entries do not change', () => {
    const logger = createTestLoggerService()
    logger.error('first')
    const before = logger.getErrors()
    logger.error('second')

    expect(before).toHaveLength(1)
    expect(logger.getErrors()).toHaveLength(2)
  })
})
