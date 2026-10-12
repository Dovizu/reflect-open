import { expect, it } from 'vitest'
import { listCommands } from '@/lib/commands/registry.ts'
import { renderWithServices } from './render-with-services.tsx'

it('registers the app commands in the installed registry', async () => {
  const { app } = await renderWithServices(null)

  expect(app.commands.list().map((command) => command.id)).toContain('nav.today')
  expect(listCommands()).toEqual(app.commands.list())
})
