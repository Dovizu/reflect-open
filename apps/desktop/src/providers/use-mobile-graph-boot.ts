import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  createMobileOnboardingService,
  defaultClock,
  defaultLogger,
  defaultMobileStorage,
  defaultSettings,
  type AppPlatform,
  type GraphSessionService,
  type MobileOnboardingService,
  type MobileStorageInfo,
  type MobileStorageKind,
} from '@reflect/core'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

export interface MobileGraphBootOptions {
  platform: AppPlatform
  /** The session the fallback service opens and parks through. */
  session: GraphSessionService
}

/** The mobile-only slice of the graph context, read from {@link MobileOnboardingService}. */
export interface MobileGraphBoot {
  /**
   * The user hasn't yet chosen where their notes live (Plan 19, step 6), so
   * both fixed roots are left untouched and the onboarding screen shows
   * instead of the graph. Always false on desktop.
   */
  needsOnboarding: boolean
  /**
   * The storage roots available to the graph (Plan 21), derived fresh at
   * bootstrap (null elsewhere). Paths must never be persisted — iOS
   * container paths change across restore/update. On a fresh install this is
   * seeded with the sandbox root alone (available instantly) while the
   * iCloud container resolves — see {@link mobileStorageResolving}.
   */
  mobileStorageInfo: MobileStorageInfo | null
  /**
   * True while the iCloud container is still resolving (the first
   * `URLForUbiquityContainerIdentifier` call on a fresh install can take a
   * long time). Onboarding shows the iCloud section as pending rather than
   * hiding it — a null `icloudDocumentsRoot` alone would read as "signed
   * out".
   */
  mobileStorageResolving: boolean
  /**
   * Which root the open graph lives in — `'icloud'` for the iCloud Drive
   * container, `'local'` for the app sandbox. Null until a graph is open
   * (and always null on desktop). The iCloud foreground refresh keys off
   * this.
   */
  mobileStorageKind: MobileStorageKind | null
  /**
   * Open a storage choice and persist it (onboarded flag, storage kind, and
   * — for iCloud — the graph *name*, since the container can hold several
   * graphs). Used by onboarding to finish, and by the settings graph
   * switcher to move between graphs. `root` selects a specific container
   * graph (or a fresh directory to create); omitted, the kind's default
   * root opens.
   */
  completeOnboarding: (kind: MobileStorageKind, root?: string) => Promise<void>
}

/**
 * The {@link MobileOnboardingService} of the nearest `AppServicesProvider`.
 * Outside one, a service of this component over the process-wide services
 * and `session`, which boots as `platform`.
 */
function useMobileOnboardingService(options: MobileGraphBootOptions): MobileOnboardingService {
  const { platform, session } = options
  const app = useOptionalAppServices()
  const [fallback] = useState(() =>
    app !== null
      ? null
      : createMobileOnboardingService({
          mobileStorage: defaultMobileStorage(),
          settings: defaultSettings(),
          graphSession: session,
          platform: { appPlatform: platform },
          clock: defaultClock(),
          logger: defaultLogger(),
        }),
  )
  const service = app?.mobileOnboarding ?? fallback
  if (service === null) {
    throw new Error('GraphProvider lost its <AppServicesProvider>')
  }
  return service
}

/**
 * The mobile graph bootstrap (Plans 19/21) as the graph context reads it:
 * boots the {@link MobileOnboardingService} and publishes its state. Inert
 * on desktop.
 */
export function useMobileGraphBoot(options: MobileGraphBootOptions): MobileGraphBoot {
  const service = useMobileOnboardingService(options)
  const { needsOnboarding, storageInfo, resolving, kind } = useSyncExternalStore(
    service.subscribe,
    service.getState,
  )

  useEffect(() => service.boot(), [service])

  return {
    needsOnboarding,
    mobileStorageInfo: storageInfo,
    mobileStorageResolving: resolving,
    mobileStorageKind: kind,
    completeOnboarding: service.completeOnboarding,
  }
}
