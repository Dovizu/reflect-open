import { createContext, use, type ReactElement, type ReactNode } from 'react'
import type { AppServices, GraphServices } from '@reflect/core'

const AppServicesContext = createContext<AppServices | null>(null)
const GraphServicesContext = createContext<GraphServices | null>(null)

export function AppServicesProvider({
  services,
  children,
}: {
  services: AppServices
  children: ReactNode
}): ReactElement {
  return <AppServicesContext value={services}>{children}</AppServicesContext>
}

export function GraphServicesProvider({
  services,
  children,
}: {
  services: GraphServices
  children: ReactNode
}): ReactElement {
  return <GraphServicesContext value={services}>{children}</GraphServicesContext>
}

/** The {@link AppServices} of the nearest `AppServicesProvider`. */
export function useAppServices(options: { optional: true }): AppServices | null
export function useAppServices(): AppServices
export function useAppServices(options?: { optional: true }): AppServices | null {
  const services = use(AppServicesContext)
  if (services === null && !options?.optional) {
    throw new Error('useAppServices() must be called inside an <AppServicesProvider>')
  }
  return services
}

/** The {@link AppServices} of the nearest `AppServicesProvider`, or `null` outside one. */
export function useOptionalAppServices(): AppServices | null {
  return use(AppServicesContext)
}

/** The {@link GraphServices} of the nearest `GraphServicesProvider`. */
export function useGraphServices(): GraphServices {
  const services = use(GraphServicesContext)
  if (services === null) {
    throw new Error('useGraphServices() must be called inside a <GraphServicesProvider>')
  }
  return services
}
