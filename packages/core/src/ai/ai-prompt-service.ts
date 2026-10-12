import type { IdService } from '../app/id-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'
import type { AiPrompt, AiPromptMode } from '../settings/schema.ts'
import type { SettingsService } from '../settings/settings-service.ts'

/** What the prompt editor collects; `id` is minted on add. */
export interface AiPromptDraft {
  label: string
  body: string
  mode: AiPromptMode
}

/**
 * The saved AI prompts (the editor AI menu's user library): CRUD over the
 * `aiPrompts` settings key. Prompts are global across graphs (they are
 * workflow, not note content), and every write rebuilds from the settings as
 * they are when the update applies, so concurrent edits do not overwrite
 * each other.
 */
export interface AiPromptService {
  /** The saved prompts, in display order. Stable until the list changes. */
  list: () => AiPrompt[]
  /** Calls `listener` after any settings change. */
  subscribe: (listener: () => void) => Unlisten
  add: (draft: AiPromptDraft) => void
  update: (id: string, draft: AiPromptDraft) => void
  remove: (id: string) => void
}

export function createAiPromptService(deps: {
  settings: Pick<SettingsService, 'get' | 'subscribe' | 'updateWith'>
  id: Pick<IdService, 'uuid'>
}): AiPromptService {
  const { settings, id: idService } = deps
  return {
    list: () => settings.get().aiPrompts,
    subscribe: (listener) => settings.subscribe(listener),
    add: (draft) => {
      const prompt: AiPrompt = { id: idService.uuid(), ...draft }
      settings.updateWith((current) => ({ aiPrompts: [...current.aiPrompts, prompt] }))
    },
    update: (id, draft) => {
      settings.updateWith((current) => ({
        aiPrompts: current.aiPrompts.map((prompt) =>
          prompt.id === id ? { id, ...draft } : prompt,
        ),
      }))
    },
    remove: (id) => {
      settings.updateWith((current) => ({
        aiPrompts: current.aiPrompts.filter((prompt) => prompt.id !== id),
      }))
    },
  }
}
