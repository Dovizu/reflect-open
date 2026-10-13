import { createContext, use, type ReactElement, type ReactNode } from 'react'
import type { AppServices, GraphServices } from '@reflect/core'

const AppServicesContext = createContext<AppServices | null>(null)
const GraphServicesContext = createContext<GraphServices<AppServices> | null>(null)

export function AppServicesProvider({
  services,
  children,
}: {
  services: AppServices
  children: ReactNode
}): ReactElement {
  return <AppServicesContext value={services}>{children}</AppServicesContext>
}

/** Provides the open graph's services; `null` while no graph session is open. */
export function GraphServicesProvider({
  services,
  children,
}: {
  services: GraphServices<AppServices> | null
  children: ReactNode
}): ReactElement {
  return <GraphServicesContext value={services}>{children}</GraphServicesContext>
}

/** The {@link AppServices} of the nearest `AppServicesProvider`; `optional` allows none. */
export function useAppServices(options: { optional: true }): AppServices | null
export function useAppServices(): AppServices
export function useAppServices(options?: { optional: true }): AppServices | null
export function useAppServices(options?: { optional: true }): AppServices | null {
  const services = use(AppServicesContext)
  if (services === null && options?.optional !== true) {
    throw new Error('useAppServices() must be called inside an <AppServicesProvider>')
  }
  return services
}

/** The {@link GraphServices} of the nearest `GraphServicesProvider`; `optional` allows none. */
export function useGraphServices(options: { optional: true }): GraphServices<AppServices> | null
export function useGraphServices(): GraphServices<AppServices>
export function useGraphServices(options?: { optional: true }): GraphServices<AppServices> | null {
  const services = use(GraphServicesContext)
  if (services === null && options?.optional !== true) {
    throw new Error('useGraphServices() must be called inside a <GraphServicesProvider>')
  }
  return services
}
