import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import {
  createThemeService,
  THEME_PREFERENCE_CACHE_KEY,
  type AppServices,
  type Settings,
  type ThemeService,
} from '@reflect/core'
import {
  createTestAppServices,
  createTestPlatformService,
  createTestSettingsService,
  createTestStorageService,
  type TestSettingsService,
  type TestStorageService,
} from '@reflect/core/testing'
import { renderWithServices } from '@/test-utils/render-with-services.tsx'
import { ThemeProvider, useTheme } from './theme-provider.tsx'

/**
 * Covers the startup-flash contract: `public/theme-init.js` paints the cached
 * preference before React boots, so this provider must leave the document alone
 * until the settings load settles.
 */

let settings: TestSettingsService
let storage: TestStorageService
let theme: ThemeService
let app: AppServices
let releaseLoad: () => void
let originalClassName: string
let originalColorScheme: string

function install(stored: Partial<Settings>, options: { gateLoad?: boolean } = {}): void {
  settings = createTestSettingsService(stored)
  const gate = Promise.withResolvers<void>()
  releaseLoad = () => gate.resolve()
  if (options.gateLoad) {
    settings.ipc.onCommand('settings_load', async () => {
      await gate.promise
      return stored
    })
  }
  storage = createTestStorageService()
  const platform = createTestPlatformService({ colorScheme: 'light' })
  theme = createThemeService({ settings, storage, platform })
  app = createTestAppServices({ settings, storage, platform, theme })
}

let current: ReturnType<typeof useTheme>

function Probe(): null {
  current = useTheme()
  return null
}

/**
 * Mount the provider over the services of the last `install`. Not through
 * `renderInApp`: that waits for the settings load, which one case gates.
 */
async function renderTheme() {
  await renderWithServices(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
    { app },
  )
  return {
    result: {
      get current() {
        return current
      },
    },
    act: async (callback: () => unknown): Promise<void> => {
      await act(async () => {
        await callback()
      })
    },
  }
}

type Act = (callback: () => unknown) => Promise<void>

/** Runs the settings load to completion inside `act`, so its updates land attached. */
async function settleLoad(act: Act): Promise<void> {
  await act(async () => {
    await theme.whenSettled()
  })
}

/** What `theme-init.js` would have applied for a dark first paint. */
function paintDarkFirstFrame(): void {
  document.documentElement.classList.add('dark')
  document.documentElement.style.colorScheme = 'dark'
}

beforeEach(() => {
  originalClassName = document.documentElement.className
  originalColorScheme = document.documentElement.style.colorScheme
})

afterEach(() => {
  document.documentElement.className = originalClassName
  document.documentElement.style.colorScheme = originalColorScheme
})

describe('ThemeProvider', () => {
  it('leaves the first-paint theme alone until the settings load settles', async () => {
    // A `light`-pinned user on a dark first paint: before the load lands the
    // preference is the `system` default, which resolves to light here.
    paintDarkFirstFrame()
    install({ theme: 'light' }, { gateLoad: true })

    const { act } = await renderTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')

    releaseLoad()
    await settleLoad(act)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('exposes the loaded preference and its resolved theme', async () => {
    install({ theme: 'system' })

    const { result, act } = await renderTheme()
    await settleLoad(act)
    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('applies and persists a preference chosen during the session', async () => {
    install({ theme: 'light' })

    const { result, act } = await renderTheme()
    await settleLoad(act)
    await act(() => {
      result.current.setTheme('dark')
    })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(settings.get().theme).toBe('dark')
    expect(storage.local.get(THEME_PREFERENCE_CACHE_KEY)).toBe('dark')
  })

  it('still applies the theme after a failed load', async () => {
    // A failed load must unblock applying the theme, or the app would be stuck
    // on theme-init.js's guess with no way to change it.
    paintDarkFirstFrame()
    install({})
    settings.failLoad()

    const { result, act } = await renderTheme()
    await settleLoad(act)
    expect(document.documentElement.style.colorScheme).toBe('light')

    await act(() => {
      result.current.setTheme('dark')
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
