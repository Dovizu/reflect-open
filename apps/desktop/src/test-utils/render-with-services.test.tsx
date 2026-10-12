import { expect, it } from 'vitest'
import { defaultCommands } from '@reflect/core'
import { renderWithServices } from './render-with-services.tsx'

it('registers the app commands in the installed registry', async () => {
  const { app } = await renderWithServices(null)

  expect(app.commands.list().map((command) => command.id)).toContain('nav.today')
  expect(defaultCommands()).toBe(app.commands)
})
