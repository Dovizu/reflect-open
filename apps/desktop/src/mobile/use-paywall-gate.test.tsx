import { focusManager } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import type { ReactNode } from 'react'
import {
  IAP_PRODUCT_IDS,
  createAppStoreEnvironmentService,
  createClassicAccessService,
  createPaywallService,
  createSubscriptionService,
  type AppServices,
} from '@reflect/core'
import {
  createTestAppServices,
  createTestAppStoreService,
  createTestIapService,
  createTestPlatformService,
  installTestServices,
} from '@reflect/core/testing'
import { usePaywallRequested } from '@/hooks/use-paywall-requested.ts'
import { AppServicesProvider } from '@/services/services-provider.tsx'
import { usePaywallGate } from './use-paywall-gate.ts'

/**
 * The hook's wiring: it reads the paywall service's gate and starts the
 * checks the gate depends on. The gate's decisions live with the service.
 */

let restore: (() => void) | null = null

afterEach(() => {
  focusManager.setFocused(undefined)
  restore?.()
  restore = null
})

function iosServices() {
  return createTestAppServices({ platform: createTestPlatformService({ appPlatform: 'ios' }) })
}

function wrapperFor(services: AppServices) {
  restore = installTestServices(services)
  return function wrapper({ children }: { children: ReactNode }) {
    return <AppServicesProvider services={services}>{children}</AppServicesProvider>
  }
}

describe('usePaywallGate', () => {
  it('follows the paywall service gate', async () => {
    const services = iosServices()
    services.paywall.setGate('show')
    const { result, act } = await renderHook(() => usePaywallGate(), {
      wrapper: wrapperFor(services),
    })
    expect(result.current).toBe('show')

    await act(() => {
      services.paywall.setGate('hide')
    })
    expect(result.current).toBe('hide')
  })

  it('starts the subscription, Reflect Classic, and install-channel checks', async () => {
    const services = iosServices()
    await renderHook(() => usePaywallGate(), { wrapper: wrapperFor(services) })

    await vi.waitFor(() => {
      expect(services.subscription.calls()).toContain('activeSubscription')
      expect(services.classicAccess.calls()).toContain('read')
      expect(services.appStoreEnvironment.calls()).toContain('environment')
    })
  })

  it('looks the subscription up again on window focus', async () => {
    const services = iosServices()
    await renderHook(() => usePaywallGate(), { wrapper: wrapperFor(services) })

    focusManager.setFocused(false)
    focusManager.setFocused(true)

    expect(services.subscription.calls()).toContain('refetch')
  })

  it('rechecks a stored Reflect Classic token on mount and on window focus', async () => {
    const services = iosServices()
    services.classicAccess.setState({
      access: { token: 'token', email: null, expiresAt: 1, checkedAt: 0 },
    })
    await renderHook(() => usePaywallGate(), { wrapper: wrapperFor(services) })
    await vi.waitFor(() => expect(services.classicAccess.calls()).toContain('load'))
    const loads = services.classicAccess.calls().filter((call) => call === 'load').length

    focusManager.setFocused(false)
    focusManager.setFocused(true)

    expect(services.classicAccess.calls().filter((call) => call === 'load')).toHaveLength(loads + 1)
  })

  it('leaves Reflect Classic alone off iOS', async () => {
    const services = createTestAppServices()
    await renderHook(() => usePaywallGate(), { wrapper: wrapperFor(services) })
    expect(services.classicAccess.calls()).toEqual([])
  })

  describe('over the real services', () => {
    function realServices() {
      const base = iosServices()
      const iap = createTestIapService()
      const appStore = createTestAppStoreService({ environment: 'Sandbox' })
      const subscription = createSubscriptionService({
        iap,
        storage: base.storage,
        clock: base.clock,
        platform: base.platform,
        logger: base.logger,
      })
      const classicAccess = createClassicAccessService({
        secretStore: base.secretStore,
        http: base.http,
        webAuth: base.webAuth,
        clock: base.clock,
        id: base.id,
        logger: base.logger,
      })
      const appStoreEnvironment = createAppStoreEnvironmentService({
        appStore,
        storage: base.storage,
        platform: base.platform,
      })
      const paywall = createPaywallService({
        subscription,
        classicAccess,
        appStoreEnvironment,
        iap,
        appStore,
        platform: base.platform,
        storage: base.storage,
      })
      return {
        iap,
        services: {
          ...base,
          iap,
          appStore,
          subscription,
          classicAccess,
          appStoreEnvironment,
          paywall,
        },
      }
    }

    it('shows the paywall on request outside the App Store, and lifts it after a purchase', async () => {
      const { iap, services } = realServices()
      const { result, act } = await renderHook(
        () => ({ gate: usePaywallGate(), requested: usePaywallRequested() }),
        { wrapper: wrapperFor(services) },
      )
      await vi.waitFor(() => expect(services.appStoreEnvironment.getState().value).toBe('Sandbox'))
      expect(result.current.gate).toBe('hide')

      await act(() => {
        result.current.requested[1](true)
      })
      await vi.waitFor(() => expect(result.current.gate).toBe('show'))

      await act(() => services.paywall.purchase(IAP_PRODUCT_IDS.monthly))
      await vi.waitFor(() => expect(result.current.gate).toBe('hide'))
      expect(iap.purchases()).toEqual([IAP_PRODUCT_IDS.monthly])
    })
  })
})
