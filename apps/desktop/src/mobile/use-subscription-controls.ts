import { useState } from 'react'
import { usePaywallRequested } from '@/hooks/use-paywall-requested.ts'
import { formatFullDate } from '@/lib/dates.ts'
import { TERMS_OF_USE_URL } from '@/mobile/legal-urls.ts'
import { useMobileServices } from '@/mobile/mobile-services.ts'
import { useActiveSubscription } from '@/mobile/use-active-subscription.ts'
import {
  classicAccessMessage,
  useClassicAccess,
  useClassicSignOut,
} from '@/mobile/use-classic-access.ts'
import { useSettings } from '@/providers/settings-provider.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * The iOS app's subscription state and the controls App Review requires
 * beside it (restore, manage, redeem, terms), in one hook so every settings
 * surface offers the same set. Actions are function properties so rows can
 * take them unbound.
 */
export interface SubscriptionControls {
  /** The plan as one line: Monthly, Yearly, a Reflect Classic grant, or none. */
  readonly planLabel: string
  /**
   * No App Store plan and no active Classic grant, so offer the paywall. Also
   * true while the lookup is still loading and the plan reads "Checking…".
   */
  readonly canSubscribe: boolean
  /** An App Store subscription the system's account page can manage. */
  readonly canManage: boolean
  /** The verified Reflect Classic account's email, when a grant exists. */
  readonly classicAccount: string | null
  /** The latest action's outcome, or the Classic grant's status. */
  readonly message: string | null
  readonly restorePending: boolean
  readonly redeemPending: boolean
  readonly removeClassicVerificationPending: boolean
  /** Show the paywall, which replaces the app until a purchase or dismissal. */
  subscribe: () => void
  manage: () => void
  restore: () => Promise<void>
  redeem: () => Promise<void>
  removeClassicVerification: () => void
  openTerms: () => void
}

export function useSubscriptionControls(): SubscriptionControls {
  const subscription = useActiveSubscription()
  const classicAccess = useClassicAccess()
  const classicSignOut = useClassicSignOut()
  const { paywall } = useMobileServices()
  const { opener } = useAppServices()
  const { settings } = useSettings()
  const [, setPaywallRequested] = usePaywallRequested()
  const [restorePending, setRestorePending] = useState(false)
  const [redeemPending, setRedeemPending] = useState(false)
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null)

  const planLabel =
    subscription.value === 'monthly'
      ? 'Monthly'
      : subscription.value === 'yearly'
        ? 'Yearly'
        : classicAccess.active && classicAccess.value !== null
          ? `Reflect Classic, until ${formatFullDate(new Date(classicAccess.value.expiresAt), settings.dateFormat)}`
          : subscription.isLoading || classicAccess.isLoading
            ? 'Checking…'
            : 'Not subscribed'

  return {
    planLabel,
    canSubscribe: subscription.value === null && !classicAccess.active,
    canManage: subscription.value !== null,
    classicAccount: classicAccess.value === null ? null : (classicAccess.value.email ?? 'Unknown'),
    message: subscriptionMessage ?? classicAccessMessage(classicAccess),
    restorePending,
    redeemPending,
    removeClassicVerificationPending: classicSignOut.isPending,
    // The request flips usePaywallGate to 'show', so the gate in
    // mobile-app.tsx replaces the app with the paywall immediately. It is
    // what makes that work outside the App Store, where the gate otherwise
    // never shows the paywall at all.
    subscribe: () => {
      setPaywallRequested(true)
    },
    manage: () => {
      opener.openUrlSync('https://apps.apple.com/account/subscriptions')
    },
    restore: async () => {
      setRestorePending(true)
      setSubscriptionMessage(null)
      try {
        const found = await paywall.restore()
        if (found === null) {
          setSubscriptionMessage('No previous purchase found for this Apple account.')
        }
      } catch {
        setSubscriptionMessage('Restore failed. Check your connection and try again.')
      } finally {
        setRestorePending(false)
      }
    },
    redeem: async () => {
      setRedeemPending(true)
      setSubscriptionMessage(null)
      try {
        await paywall.redeemCode()
      } catch {
        setSubscriptionMessage('Could not open the redemption sheet. Try again.')
      } finally {
        setRedeemPending(false)
      }
    },
    removeClassicVerification: () => {
      classicSignOut.mutate()
    },
    openTerms: () => {
      opener.openUrlSync(TERMS_OF_USE_URL)
    },
  }
}
