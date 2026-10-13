import { noteEditorHandleFor } from '@/editor/editor-handle-registry.ts'
import type { CommandContext } from '@/lib/commands/types.ts'

/**
 * The Attach file… command for the routed note: see
 * `AttachmentService.attachFilesToNote`. No-ops without an open graph or a
 * routed note.
 */
export async function attachFilesToNote(context: CommandContext): Promise<void> {
  const notePath = context.notePath()
  if (notePath === null) {
    return
  }
  await context.services.attachments.attachFilesToNote({
    findEditor: () => noteEditorHandleFor(notePath),
  })
}
