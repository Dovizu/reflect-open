import type { AiPrompt, AiPromptDraft } from '@reflect/core'
import { useAppServices } from '@/services/services-provider.tsx'
import { useServiceState } from '@/services/use-service-state.ts'

export type { AiPromptDraft } from '@reflect/core'

interface UseAiPromptsValue {
  prompts: AiPrompt[]
  addPrompt: (draft: AiPromptDraft) => void
  updatePrompt: (id: string, draft: AiPromptDraft) => void
  removePrompt: (id: string) => void
}

/**
 * The saved-AI-prompts surface (the editor AI menu's user library), over the `AiPromptService`.
 */
export function useAiPrompts(): UseAiPromptsValue {
  const { aiPrompts: service } = useAppServices()
  const prompts = useServiceState(service, service.list)
  return {
    prompts,
    addPrompt: service.add,
    updatePrompt: service.update,
    removePrompt: service.remove,
  }
}
