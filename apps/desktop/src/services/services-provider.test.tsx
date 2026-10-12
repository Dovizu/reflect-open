import { render } from 'vitest-browser-react'
import { describe, expect, it } from 'vitest'
import { defaultClock } from '@reflect/core'
import { createTestAppServices } from '@reflect/core/testing'
import { useAppServices, useGraphServices } from '@/services/services-provider.tsx'
import { renderWithServices } from '@/test-utils/render-with-services.tsx'

function AppVersion() {
  const { platform } = useAppServices()
  return <p>version {platform.appVersion}</p>
}

function GraphRoot() {
  const { session, role } = useGraphServices()
  return (
    <p>
      {role} {session.root}
    </p>
  )
}

describe('services providers', () => {
  it('gives components the app services', async () => {
    const screen = await renderWithServices(<AppVersion />)
    await expect.element(screen.getByText('version 0.0.0-test')).toBeVisible()
    expect(screen.app.platform.appVersion).toBe('0.0.0-test')
  })

  it('gives components the graph services', async () => {
    const screen = await renderWithServices(<GraphRoot />)
    await expect.element(screen.getByText('main /graphs/test')).toBeVisible()
  })

  it('installs the app services as the defaults for the test', async () => {
    const app = createTestAppServices()
    await renderWithServices(<AppVersion />, { app })
    expect(defaultClock()).toBe(app.clock)
  })

  it('throws outside the providers', async () => {
    await expect(render(<AppVersion />)).rejects.toThrow(
      /useAppServices\(\) must be called inside an <AppServicesProvider>/,
    )
  })
})
