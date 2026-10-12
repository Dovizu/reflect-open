import { describe, expect, it } from 'vitest'
import { createTestPlatformService } from './platform.ts'

describe('createTestPlatformService', () => {
  it('defaults to a macOS desktop native shell', () => {
    const platform = createTestPlatformService()
    expect(platform.appPlatform).toBe('desktop')
    expect(platform.isNativeShell).toBe(true)
    expect(platform.isMacosDesktop).toBe(true)
    expect(platform.isApplePlatform).toBe(true)
    expect(platform.hasMacosTitleBarOverlay).toBe(true)
    expect(platform.surface).toEqual({ touchEditor: false, mobileApp: false })
    expect(platform.prefersReducedMotion()).toBe(false)
    expect(platform.colorScheme()).toBe('light')
  })

  it('applies overrides', () => {
    const platform = createTestPlatformService({
      appPlatform: 'ios',
      isMacosDesktop: false,
      surface: { mobileApp: true },
      reducedMotion: true,
      colorScheme: 'dark',
    })
    expect(platform.appPlatform).toBe('ios')
    expect(platform.isMacosDesktop).toBe(false)
    expect(platform.isNativeShell).toBe(true)
    expect(platform.surface).toEqual({ touchEditor: false, mobileApp: true })
    expect(platform.prefersReducedMotion()).toBe(true)
    expect(platform.colorScheme()).toBe('dark')
  })

  it('notifies subscribers of preference changes', () => {
    const platform = createTestPlatformService()
    const motion: boolean[] = []
    const schemes: string[] = []
    const stopMotion = platform.subscribeReducedMotion((value) => {
      motion.push(value)
    })
    platform.subscribeColorScheme((value) => {
      schemes.push(value)
    })

    platform.setReducedMotion(true)
    platform.setReducedMotion(true)
    platform.setColorScheme('dark')
    stopMotion()
    platform.setReducedMotion(false)

    expect(motion).toEqual([true])
    expect(schemes).toEqual(['dark'])
    expect(platform.prefersReducedMotion()).toBe(false)
  })
})
