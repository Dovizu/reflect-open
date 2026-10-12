import { defaultChatHistory, type ChatConversation } from './chat-history-service.ts'

export type { ChatConversation } from './chat-history-service.ts'

/** The most recently active conversations, newest first. */
export async function listChatConversations(limit = 50): Promise<ChatConversation[]> {
  return await defaultChatHistory().listRecent(limit)
}
