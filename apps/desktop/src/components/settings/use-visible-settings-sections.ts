import { useContactsState } from '@/hooks/use-contacts-state.ts'
import { useCoreServices } from '@/services/services-provider.tsx'
import { SETTINGS_SECTIONS } from './sections.ts'

/** One registered settings section (see {@link SETTINGS_SECTIONS}). */
export type SettingsSectionEntry = (typeof SETTINGS_SECTIONS)[number]

/**
 * The settings sections this platform actually shows. Integrations
 * only exists where the OS frameworks do (macOS/iOS — the Rust shell answers
 * `unavailable` elsewhere). Agents is macOS-only. The iOS app (the iPad's
 * desktop settings) trades Import and the Danger zone, which assume a graph
 * folder of the user's choosing, for its Graph and Subscription sections. The
 * navigator must agree with the page, so both filter through here rather than
 * reading the registry directly.
 */
export function useVisibleSettingsSections(): readonly SettingsSectionEntry[] {
  const { authorization } = useContactsState()
  const { platform } = useCoreServices()
  const hasAppleIntegrations =
    platform.isMacosDesktop || (authorization !== null && authorization !== 'unavailable')
  const ios = platform.appPlatform === 'ios'
  return SETTINGS_SECTIONS.filter((section) => {
    switch (section.id) {
      case 'integrations':
        return hasAppleIntegrations
      case 'agents':
        return platform.isMacosDesktop
      case 'graph':
      case 'subscription':
        return ios
      case 'import':
      case 'destructive':
        return !ios
      default:
        return true
    }
  })
}
