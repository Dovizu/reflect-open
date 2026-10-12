import { defaultNoteActions, type NoteDeepLinkFormat } from '@reflect/core'
import { dailyDeepLink, noteDeepLink } from '@/lib/deep-links/format.ts'

const format: NoteDeepLinkFormat = { note: noteDeepLink, daily: dailyDeepLink }

/**
 * "Copy deep link" (the v1 `alt+mod+l` port): the most durable `reflect://`
 * address the note can have; see `NoteActionsService.deepLinkFor`.
 */
export async function deepLinkForNote(path: string, generation: number): Promise<string> {
  return await defaultNoteActions().deepLinkFor(path, generation, format)
}

/**
 * The copy action as keyboard surfaces run it (⌥⌘L and the ⌘K command):
 * build the link, put it on the clipboard, and confirm through the operations
 * status line, the app's no-toast feedback channel.
 */
export async function runCopyDeepLink(path: string, generation: number): Promise<void> {
  await defaultNoteActions().copyDeepLink(path, generation, format)
}
