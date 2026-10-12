import { describe, expect, it } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { StrictMode, type ReactNode } from 'react'
import { createTestAppServices, createTestSettingsService } from '@reflect/core/testing'
import { renderHookInApp } from '@/test-utils/render-in-app.tsx'
import { SettingsProvider, useSettings } from './settings-provider.tsx'

describe('SettingsProvider', () => {
  it('renders the settings of the app services and forwards updates', async () => {
    const settings = createTestSettingsService({ editorMarkdownSyntax: 'show' })
    const app = createTestAppServices({ settings })
    const { result, act } = await renderHookInApp(() => useSettings(), { app })

    await act(async () => {
      await expect(result.current.whenSettingsLoaded()).resolves.toBe('loaded')
    })
    expect(result.current.settings).toBe(settings.get())
    expect(result.current.settings.editorMarkdownSyntax).toBe('show')

    await act(() => {
      result.current.updateSettings({ editorFullWidth: true })
    })
    expect(result.current.settings.editorFullWidth).toBe(true)

    await act(() => {
      result.current.updateSettingsWith((current) => ({
        editorTextSize: current.editorFullWidth ? 'large' : 'small',
      }))
    })
    expect(result.current.settings.editorTextSize).toBe('large')
    await settings.flush()
    expect(settings.saves().at(-1)).toBe(settings.get())
  })

  it('loads once in StrictMode', async () => {
    const settings = createTestSettingsService()
    const app = createTestAppServices({ settings })
    // The provider under test is the inner one, inside StrictMode.
    const { result, act } = await renderHookInApp(() => useSettings(), {
      app,
      wrapper: (children: ReactNode) => (
        <StrictMode>
          <SettingsProvider>{children}</SettingsProvider>
        </StrictMode>
      ),
    })
    await act(async () => {
      await result.current.whenSettingsLoaded()
    })
    const loads = settings.ipc.calls().filter(({ command }) => command === 'settings_load')
    expect(loads).toHaveLength(1)
  })

  it('returns null outside a SettingsProvider when optional', async () => {
    const { result } = await renderHook(() => useSettings({ optional: true }))
    expect(result.current).toBeNull()
  })
})
