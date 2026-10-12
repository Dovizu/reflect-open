import { defaultNoteActions } from '@reflect/core'

/**
 * "Copy deep link" (the v1 `alt+mod+l` port): the most durable `reflect://`
 * address the note can have; see `NoteActionsService.deepLinkFor`.
 */
export async function deepLinkForNote(path: string, generation: number): Promise<string> {
  return await defaultNoteActions().deepLinkFor(path, generation)
}

/**
 * The copy action as keyboard surfaces run it (⌥⌘L and the ⌘K command):
 * build the link, put it on the clipboard, and confirm through the operations
 * status line, the app's no-toast feedback channel.
 */
export async function runCopyDeepLink(path: string, generation: number): Promise<void> {
  await defaultNoteActions().copyDeepLink(path, generation)
}
