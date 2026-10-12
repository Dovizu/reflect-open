import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDefaultLifecycle } from '@reflect/core'
import { createTestLifecycleService, type TestLifecycleService } from '@reflect/core/testing'
import { attachResumeListeners } from '@/lib/resume-listeners.ts'

let lifecycle: TestLifecycleService

beforeEach(() => {
  lifecycle = createTestLifecycleService()
  setDefaultLifecycle(lifecycle)
})

describe('attachResumeListeners', () => {
  it('calls back when the app resumes', () => {
    const onResume = vi.fn()
    const dispose = attachResumeListeners(onResume)

    lifecycle.emitResume()

    expect(onResume).toHaveBeenCalledOnce()
    dispose()
  })

  it('stops calling back after dispose', () => {
    const onResume = vi.fn()
    const dispose = attachResumeListeners(onResume)

    dispose()
    lifecycle.emitResume()

    expect(onResume).not.toHaveBeenCalled()
  })
})
