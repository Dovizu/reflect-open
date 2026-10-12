import type {
  ClassicAccessService,
  ClassicAccessState,
  ClassicSignInOptions,
  ClassicSignInResult,
} from '../classic/classic-access-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type {
  AppStoreEnvironment,
  AppStoreEnvironmentService,
  AppStoreEnvironmentState,
} from '../monetization/app-store-environment-service.ts'
import type { PaywallGate, PaywallService } from '../monetization/paywall-service.ts'
import type {
  SubscriptionService,
  SubscriptionState,
} from '../monetization/subscription-service.ts'

interface Listeners {
  subscribe: (listener: () => void) => Unlisten
  notify: () => void
}

function createListeners(): Listeners {
  const listeners = new Set<() => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    notify() {
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

export type ClassicAccessCall = 'read' | 'load' | 'signIn' | 'signOut' | 'start'

export interface TestClassicAccessService extends ClassicAccessService {
  /** Replaces part of the state and notifies subscribers. */
  setState(patch: Partial<ClassicAccessState>): void
  /** Answers every later `signIn`. */
  setSignIn(handler: (options: ClassicSignInOptions) => Promise<ClassicSignInResult>): void
  /** Every call, in order. */
  calls(): readonly ClassicAccessCall[]
  /** The options of every `signIn`, in order. */
  signIns(): readonly ClassicSignInOptions[]
}

/**
 * A {@link ClassicAccessService} over a settable state. `read` and `load`
 * resolve the stored access; `signIn` resolves `cancelled` until `setSignIn`;
 * `signOut` clears the access; `start` only records the call.
 */
export function createTestClassicAccessService(
  state?: Partial<ClassicAccessState>,
): TestClassicAccessService {
  let current: ClassicAccessState = { access: null, active: false, isLoading: false, ...state }
  let signIn: (options: ClassicSignInOptions) => Promise<ClassicSignInResult> = async () => ({
    kind: 'cancelled',
  })
  const log: ClassicAccessCall[] = []
  const signInLog: ClassicSignInOptions[] = []
  const listeners = createListeners()
  const setState = (patch: Partial<ClassicAccessState>): void => {
    current = { ...current, ...patch }
    listeners.notify()
  }
  return {
    getState: () => current,
    subscribe: listeners.subscribe,
    read() {
      log.push('read')
      return Promise.resolve(current.access)
    },
    load() {
      log.push('load')
      return Promise.resolve(current.access)
    },
    async signIn(options) {
      log.push('signIn')
      signInLog.push(options)
      return await signIn(options)
    },
    signOut() {
      log.push('signOut')
      setState({ access: null, active: false })
      return Promise.resolve()
    },
    start() {
      log.push('start')
      return () => {}
    },
    setState,
    setSignIn(handler) {
      signIn = handler
    },
    calls: () => [...log],
    signIns: () => [...signInLog],
  }
}

export type SubscriptionCall = 'activeSubscription' | 'refetch' | 'invalidate'

export interface TestSubscriptionService extends SubscriptionService {
  /** Replaces part of the state and notifies subscribers. */
  setState(patch: Partial<SubscriptionState>): void
  /** Every call, in order. */
  calls(): readonly SubscriptionCall[]
}

/** A {@link SubscriptionService} over a settable state; lookups resolve the current value. */
export function createTestSubscriptionService(
  state?: Partial<SubscriptionState>,
): TestSubscriptionService {
  let current: SubscriptionState = { value: null, isLoading: false, isError: false, ...state }
  const log: SubscriptionCall[] = []
  const listeners = createListeners()
  return {
    getState: () => current,
    subscribe: listeners.subscribe,
    activeSubscription() {
      log.push('activeSubscription')
      return Promise.resolve(current.value)
    },
    refetch() {
      log.push('refetch')
      return Promise.resolve(current.value)
    },
    invalidate() {
      log.push('invalidate')
    },
    setState(patch) {
      current = { ...current, ...patch }
      listeners.notify()
    },
    calls: () => [...log],
  }
}

export type AppStoreEnvironmentCall = 'environment' | 'invalidate'

export interface TestAppStoreEnvironmentService extends AppStoreEnvironmentService {
  /** Replaces part of the state and notifies subscribers. */
  setState(patch: Partial<AppStoreEnvironmentState>): void
  /** Every call, in order. */
  calls(): readonly AppStoreEnvironmentCall[]
}

/** An {@link AppStoreEnvironmentService} that answers `env`; defaults to `Production`. */
export function createTestAppStoreEnvironmentService(
  env: AppStoreEnvironment = 'Production',
): TestAppStoreEnvironmentService {
  let current: AppStoreEnvironmentState = { value: env, isLoading: false, isError: false }
  const log: AppStoreEnvironmentCall[] = []
  const listeners = createListeners()
  return {
    getState: () => current,
    subscribe: listeners.subscribe,
    environment() {
      log.push('environment')
      return Promise.resolve(current.value)
    },
    invalidate() {
      log.push('invalidate')
    },
    setState(patch) {
      current = { ...current, ...patch }
      listeners.notify()
    },
    calls: () => [...log],
  }
}

export type PaywallAction =
  | { kind: 'products' }
  | { kind: 'purchase'; productId: string }
  | { kind: 'restore' }
  | { kind: 'redeemCode' }

export interface TestPaywallService extends PaywallService {
  /** Changes the gate and notifies subscribers. */
  setGate(gate: PaywallGate): void
  /** Every action, in order. */
  actions(): readonly PaywallAction[]
}

/**
 * A {@link PaywallService} whose gate is `gate` until `setGate`. Products are
 * empty, actions resolve at once, and `restore` finds nothing.
 */
export function createTestPaywallService(gate: PaywallGate = 'hide'): TestPaywallService {
  let current = gate
  let requested = false
  const log: PaywallAction[] = []
  const listeners = createListeners()
  return {
    gate: () => current,
    subscribe: listeners.subscribe,
    requested: () => requested,
    setRequested(next) {
      if (next === requested) return
      requested = next
      listeners.notify()
    },
    products() {
      log.push({ kind: 'products' })
      return Promise.resolve([])
    },
    purchase(productId) {
      log.push({ kind: 'purchase', productId })
      return Promise.resolve()
    },
    restore() {
      log.push({ kind: 'restore' })
      return Promise.resolve(null)
    },
    redeemCode() {
      log.push({ kind: 'redeemCode' })
      return Promise.resolve()
    },
    setGate(next) {
      current = next
      listeners.notify()
    },
    actions: () => [...log],
  }
}
