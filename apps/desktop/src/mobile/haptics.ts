import type { MobileAppServices } from '@/mobile/use-mobile-app-services.ts'

/**
 * Fire a light impact haptic: V1 parity for calendar-strip date taps and
 * tab presses, plus task-surface confirmations. WKWebView has no
 * `navigator.vibrate`, so the tap goes through the first-party haptics
 * plugin (`plugins/tauri-plugin-mobile-haptics`). Fire-and-forget and
 * fail-soft; see `HapticsService.impactLight`.
 */
export function hapticImpactLight({ haptics }: Pick<MobileAppServices, 'haptics'>): void {
  void haptics.impactLight().catch(() => {})
}
