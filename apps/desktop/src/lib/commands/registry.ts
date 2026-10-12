import { defaultCommands, type CommandService } from '@reflect/core'
import type { AppCommand, CommandContext } from './types.ts'

/**
 * The command registry (Plan 08): a flat, collision-checked id → command map.
 * The palette lists it, the app keymap binds it, and deep links/CLI will look
 * commands up by id — one command system, not three.
 */

/** The process-wide registry, typed with the context this app's commands run with. */
function appCommands(): CommandService<CommandContext> {
  return defaultCommands()
}

/** Register commands; duplicate or blank ids/titles are programmer errors. */
export function registerCommands(definitions: AppCommand[]): void {
  appCommands().register(definitions)
}

/** Every registered command, in registration order. */
export function listCommands(): AppCommand[] {
  return appCommands().list()
}

/** Run a command by id; unknown ids are a loud no-op (deep links may dangle). */
export async function runCommand(id: string, context: CommandContext): Promise<void> {
  await appCommands().run(id, context)
}
