import {
  defaultChatHistory,
  type ChatConversation,
  type SaveChatTurnInput,
} from './chat-history-service.ts'
import type { ChatTurn } from './transcript.ts'

export type { ChatConversation } from './chat-history-service.ts'

/** Save one turn (and upsert its conversation row) for `generation`. */
export async function saveChatMessage(input: SaveChatTurnInput): Promise<void> {
  await defaultChatHistory().saveTurn(input)
}

/** Delete a conversation and its messages (for `generation`). */
export async function deleteChatConversation(id: string, generation: number): Promise<void> {
  await defaultChatHistory().deleteConversation(id, generation)
}

/** The most recently active conversations, newest first. */
export async function listChatConversations(limit = 50): Promise<ChatConversation[]> {
  return await defaultChatHistory().listRecent(limit)
}

/** Load a conversation's turns in order. */
export async function loadChatMessages(conversationId: string): Promise<ChatTurn[]> {
  return await defaultChatHistory().loadConversation(conversationId)
}
