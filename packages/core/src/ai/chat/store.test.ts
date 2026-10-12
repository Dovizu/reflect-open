import { afterEach, describe, expect, it } from 'vitest'
import { createTestChatHistoryService } from '../../testing/chat.ts'
import { setDefaultChatHistory } from './chat-history-service.ts'
import { listChatConversations } from './store.ts'

const conversation = { id: 'conv-1', title: 'what is this?', createdMs: 1_000, updatedMs: 2_000 }

afterEach(() => {
  setDefaultChatHistory(null)
})

describe('chat store', () => {
  it('delegates to the default chat history', async () => {
    setDefaultChatHistory(
      createTestChatHistoryService({ conversations: [{ conversation, turns: [] }] }),
    )

    await expect(listChatConversations()).resolves.toEqual([conversation])
  })
})
