import type {
  ChatConversation,
  ChatHistoryService,
  SaveChatTurnInput,
} from '../ai/chat/chat-history-service.ts'
import type { ChatTurn } from '../ai/chat/transcript.ts'

export interface TestChatConversation {
  conversation: ChatConversation
  /** The persisted turns, in order. */
  turns: readonly ChatTurn[]
}

export interface TestChatHistoryServiceOptions {
  conversations?: readonly TestChatConversation[]
}

export interface TestChatHistoryService extends ChatHistoryService {
  /** Every `saveTurn` input, in order. */
  getSaves(): readonly SaveChatTurnInput[]
  /** Every deleted conversation id, in order. */
  getDeletes(): readonly string[]
}

interface StoredConversation {
  conversation: ChatConversation
  turns: ChatTurn[]
}

/**
 * An in-memory {@link ChatHistoryService} with the native write rules: a
 * save keeps the conversation's title and `createdMs` and bumps its
 * `updatedMs`, and a turn saved again keeps its position. Loaded turns are
 * copies restored as `done`.
 */
export function createTestChatHistoryService(
  options?: TestChatHistoryServiceOptions,
): TestChatHistoryService {
  const stored = new Map<string, StoredConversation>()
  for (const seed of options?.conversations ?? []) {
    stored.set(seed.conversation.id, {
      conversation: { ...seed.conversation },
      turns: seed.turns.map((turn) => structuredClone(turn)),
    })
  }
  const saves: SaveChatTurnInput[] = []
  const deletes: string[] = []

  return {
    async saveTurn(input) {
      saves.push(structuredClone(input))
      let entry = stored.get(input.conversation.id)
      if (entry === undefined) {
        entry = { conversation: { ...input.conversation }, turns: [] }
        stored.set(input.conversation.id, entry)
      } else {
        entry.conversation = { ...entry.conversation, updatedMs: input.conversation.updatedMs }
      }
      const turn = structuredClone(input.turn)
      const index = entry.turns.findIndex((existing) => existing.id === turn.id)
      if (index === -1) {
        entry.turns.push(turn)
      } else {
        entry.turns[index] = turn
      }
    },
    async deleteConversation(id) {
      deletes.push(id)
      stored.delete(id)
    },
    async listRecent(limit = 50) {
      return [...stored.values()]
        .map((entry) => ({ ...entry.conversation }))
        .sort((a, b) => b.updatedMs - a.updatedMs)
        .slice(0, limit)
    },
    async loadConversation(conversationId) {
      const entry = stored.get(conversationId)
      return (entry?.turns ?? []).map((turn) => ({ ...structuredClone(turn), status: 'done' }))
    },
    getSaves: () => [...saves],
    getDeletes: () => [...deletes],
  }
}
