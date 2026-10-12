import { defaultNoteActions } from '@reflect/core'

/**
 * "Copy note path" as keyboard surfaces run it (⌥⌘C and the ⌘K command):
 * `NoteActionsService.copyPath`.
 */
export async function runCopyNotePath(root: string | null, path: string): Promise<void> {
  await defaultNoteActions().copyPath(root, path)
}
