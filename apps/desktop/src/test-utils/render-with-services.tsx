import type { ReactNode } from 'react'
import { onTestFinished } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import type { AppServices, GraphServices } from '@reflect/core'
import {
  createTestAppServices,
  createTestGraphServices,
  installTestServices,
  type TestAppServices,
  type TestGraphServices,
} from '@reflect/core/testing'
import { registerAppCommands } from '@/lib/commands/app-commands.ts'
import { AppServicesProvider, GraphServicesProvider } from '@/services/services-provider.tsx'

export interface ServicesRenderResult<
  App extends AppServices,
  Graph extends GraphServices,
> extends RenderResult {
  readonly app: App
  readonly graph: Graph
}

/**
 * Render `ui` inside both services providers. `app` and `graph` default to
 * test doubles (`app` to `graph.app` when only `graph` is given), and `app`
 * is also installed as the process-wide defaults until the test finishes.
 * The app commands are registered in `app.commands`, like `main.tsx` does.
 */
export async function renderWithServices(
  ui: ReactNode,
): Promise<ServicesRenderResult<TestAppServices, TestGraphServices>>
export async function renderWithServices(
  ui: ReactNode,
  options: { app?: AppServices; graph?: GraphServices },
): Promise<ServicesRenderResult<AppServices, GraphServices>>
export async function renderWithServices(
  ui: ReactNode,
  options?: { app?: AppServices; graph?: GraphServices },
): Promise<ServicesRenderResult<AppServices, GraphServices>> {
  const app = options?.app ?? options?.graph?.app ?? createTestAppServices()
  const graph = options?.graph ?? createTestGraphServices(app)
  const restore = installTestServices(app)
  registerAppCommands()
  const screen = await render(
    <AppServicesProvider services={app}>
      <GraphServicesProvider services={graph}>{ui}</GraphServicesProvider>
    </AppServicesProvider>,
  )
  onTestFinished(() => {
    screen.unmount()
    restore()
  })
  return Object.assign(screen, { app, graph })
}
