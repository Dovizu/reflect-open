import { useSyncExternalStore } from 'react'

interface ServiceStore {
  readonly subscribe: (listener: () => void) => () => void
}

/** The state of `service`, re-rendered on every change it reports. */
export function useServiceState<S>(service: ServiceStore & { readonly getState: () => S }): S
/** What `read` returns, re-rendered on every change `service` reports. */
export function useServiceState<S>(service: ServiceStore, read: () => S): S
export function useServiceState<S>(service: ServiceStore, read?: () => S): S {
  const getSnapshot = read ?? (service as ServiceStore & { readonly getState: () => S }).getState
  return useSyncExternalStore(service.subscribe, getSnapshot, getSnapshot)
}
