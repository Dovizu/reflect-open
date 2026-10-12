import {
  createMobileOnboardingService,
  type MobileOnboardingService,
  type MobileOnboardingServiceDeps,
  type MobileOnboardingState,
} from '../graph/mobile-onboarding-service.ts'
import { createTestClockService } from './clock.ts'
import { createTestGraphSessionService } from './graph-session.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestMobileStorageService } from './mobile-storage.ts'
import { createTestPlatformService } from './platform.ts'
import { createTestSettingsService } from './settings.ts'
import { createTestLifecycleService } from './shell.ts'

/** The services a test mobile onboarding runs on; each defaults to a fresh test double. */
export interface TestMobileOnboardingServiceOptions extends Partial<MobileOnboardingServiceDeps> {
  /** Reported over the real state from the start, as {@link TestMobileOnboardingService.setState} does. */
  state?: Partial<MobileOnboardingState>
}

export interface TestMobileOnboardingService extends MobileOnboardingService {
  /** Report `patch` over the real state and notify subscribers. */
  setState: (patch: Partial<MobileOnboardingState>) => void
}

/** The real {@link MobileOnboardingService} over test doubles, plus state seeding. */
export function createTestMobileOnboardingService(
  options?: TestMobileOnboardingServiceOptions,
): TestMobileOnboardingService {
  const service = createMobileOnboardingService({
    mobileStorage: options?.mobileStorage ?? createTestMobileStorageService(),
    settings: options?.settings ?? createTestSettingsService(),
    graphSession: options?.graphSession ?? createTestGraphSessionService(),
    platform: options?.platform ?? createTestPlatformService(),
    clock: options?.clock ?? createTestClockService(),
    lifecycle: options?.lifecycle ?? createTestLifecycleService(),
    logger: options?.logger ?? createTestLoggerService(),
  })

  const listeners = new Set<() => void>()
  let overlay: Partial<MobileOnboardingState> = options?.state ?? {}
  let merged: { base: MobileOnboardingState; overlay: Partial<MobileOnboardingState> } | null = null
  let snapshot: MobileOnboardingState = service.getState()

  return {
    ...service,
    getState: () => {
      const base = service.getState()
      if (merged?.base !== base || merged.overlay !== overlay) {
        merged = { base, overlay }
        snapshot = { ...base, ...overlay }
      }
      return snapshot
    },
    subscribe: (listener) => {
      const unlisten = service.subscribe(listener)
      listeners.add(listener)
      return () => {
        unlisten()
        listeners.delete(listener)
      }
    },
    setState: (patch) => {
      overlay = { ...overlay, ...patch }
      for (const listener of listeners) {
        listener()
      }
    },
  }
}
