import { afterEach, describe, expect, it } from 'vitest'
import { setDefaultPlatform } from '../app/platform-service.ts'
import { createTestAudioRecorderService } from '../testing/audio-recorder.ts'
import { createTestPlatformService } from '../testing/platform.ts'
import { defaultAudioRecorder, setDefaultAudioRecorder } from './default-audio-recorder.ts'

afterEach(() => {
  setDefaultAudioRecorder(null)
  setDefaultPlatform(null)
})

describe('defaultAudioRecorder', () => {
  // Node has no `MediaRecorder`, so only the native recorder reports support.
  it('is the webview recorder on desktop', () => {
    setDefaultPlatform(createTestPlatformService())
    expect(defaultAudioRecorder().isSupported()).toBe(false)
  })

  it('is the native recorder on a mobile platform', () => {
    setDefaultPlatform(createTestPlatformService({ appPlatform: 'ios' }))
    expect(defaultAudioRecorder().isSupported()).toBe(true)
  })

  it('is the native recorder on the mobile surface', () => {
    setDefaultPlatform(createTestPlatformService({ surface: { mobileApp: true } }))
    expect(defaultAudioRecorder().isSupported()).toBe(true)
  })

  it('keeps one instance until replaced', () => {
    const first = defaultAudioRecorder()
    expect(defaultAudioRecorder()).toBe(first)

    const installed = createTestAudioRecorderService()
    setDefaultAudioRecorder(installed)
    expect(defaultAudioRecorder()).toBe(installed)
  })
})
