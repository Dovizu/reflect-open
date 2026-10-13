import { noteEditorHandleFor } from '@/editor/editor-handle-registry.ts'
import type { CommandContext } from '@/lib/commands/types.ts'

/**
 * The Attach file… command for the routed note: the native file picker, then
 * `AttachmentService.attachFilesToNote`. No-ops without an open graph, a
 * routed note or a mounted editor.
 */
export async function attachFilesToNote(context: CommandContext): Promise<void> {
  const notePath = context.notePath()
  if (notePath === null) {
    return
  }
  const { attachments, graphSession } = context.services
  const { dialog } = context.app
  const findEditor = () => noteEditorHandleFor(notePath)
  if (graphSession.getState().session === null || findEditor() === null) {
    return
  }
  const sources = await dialog.pickFiles({ multiple: true, title: 'Attach files' })
  if (sources === null) {
    return
  }
  await attachments.attachFilesToNote({ sources, findEditor })
}
