import { defaultSettings, type SettingsService } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'

/** The {@link SettingsService} of the nearest `AppServicesProvider`, else the process-wide one. */
export function useSettingsService(): SettingsService {
  return useAppServices({ optional: true })?.settings ?? defaultSettings()
}
