import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultOpener } from '@reflect/core'
import {
  createTestLoggerService,
  createTestOpenerService,
  type TestLoggerService,
  type TestOpenerService,
} from '@reflect/core/testing'
import { openUrl, openUrlSync } from './open-url.ts'

let logger: TestLoggerService
let opener: TestOpenerService

beforeEach(() => {
  logger = createTestLoggerService()
  opener = createTestOpenerService({ logger })
  setDefaultOpener(opener)
})

describe('openUrl', () => {
  it('forwards the url to the opener', async () => {
    await openUrl('https://example.com')
    expect(opener.openedUrls()).toEqual(['https://example.com'])
  })
})

describe('openUrlSync', () => {
  it('forwards the url to the opener', async () => {
    openUrlSync('https://example.com')
    await vi.waitFor(() => expect(opener.openedUrls()).toEqual(['https://example.com']))
  })

  it('logs instead of throwing when the opener rejects', async () => {
    opener.failWith(new Error('no handler'))
    expect(() => openUrlSync('https://example.com')).not.toThrow()
    await vi.waitFor(() => {
      expect(logger.getErrors()).toEqual([
        { message: 'failed to open https://example.com:', cause: 'no handler' },
      ])
    })
  })
})
