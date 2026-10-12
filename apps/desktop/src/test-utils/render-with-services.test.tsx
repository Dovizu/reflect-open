import { expect, it } from 'vitest'
import { renderWithServices } from './render-with-services.tsx'

it('registers the app commands in the registry of the app', async () => {
  const { app } = await renderWithServices(null)

  expect(app.commands.list().map((command) => command.id)).toContain('nav.today')
})
