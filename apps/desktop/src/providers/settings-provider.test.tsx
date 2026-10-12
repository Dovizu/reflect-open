import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { StrictMode, type ReactNode } from 'react'
import { setDefaultSettings } from '@reflect/core'
import { createTestAppServices, createTestSettingsService } from '@reflect/core/testing'
import { AppServicesProvider } from '@/services/services-provider.tsx'
import { SettingsProvider, useSettings } from './settings-provider.tsx'

function wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>
}

afterEach(() => {
  setDefaultSettings(null)
})

describe('SettingsProvider', () => {
  it('renders the process-wide settings and forwards updates', async () => {
    const settings = createTestSettingsService({ editorMarkdownSyntax: 'show' })
    setDefaultSettings(settings)
    const { result, act } = await renderHook(() => useSettings(), { wrapper })

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

  it('prefers the settings of the enclosing app services', async () => {
    setDefaultSettings(createTestSettingsService())
    const app = createTestAppServices({
      settings: createTestSettingsService({ editorFullWidth: true }),
    })
    const { result, act } = await renderHook(() => useSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AppServicesProvider services={app}>
          <SettingsProvider>{children}</SettingsProvider>
        </AppServicesProvider>
      ),
    })
    await act(async () => {
      await result.current.whenSettingsLoaded()
    })
    expect(result.current.settings.editorFullWidth).toBe(true)
  })

  it('loads once in StrictMode', async () => {
    const settings = createTestSettingsService()
    setDefaultSettings(settings)
    const { result, act } = await renderHook(() => useSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
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
