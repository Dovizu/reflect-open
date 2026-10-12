import { afterEach, describe, expect, it } from 'vitest'
import { createTestChatHistoryService } from '../../testing/chat.ts'
import { setDefaultChatHistory } from './chat-history-service.ts'
import {
  deleteChatConversation,
  listChatConversations,
  loadChatMessages,
  saveChatMessage,
} from './store.ts'
import type { ChatTurn } from './transcript.ts'

const turn: ChatTurn = {
  id: 'turn-1',
  userText: 'what is this?',
  attachments: [],
  parts: [{ kind: 'text', text: 'A cat.' }],
  responseMessages: [{ role: 'assistant', content: 'A cat.' }],
  status: 'done',
}

const conversation = { id: 'conv-1', title: 'what is this?', createdMs: 1_000, updatedMs: 2_000 }

afterEach(() => {
  setDefaultChatHistory(null)
})

describe('chat store', () => {
  it('delegates to the default chat history', async () => {
    const history = createTestChatHistoryService()
    setDefaultChatHistory(history)

    await saveChatMessage({ conversation, turn, createdMs: 2_000, generation: 7 })
    expect(history.getSaves()).toEqual([{ conversation, turn, createdMs: 2_000, generation: 7 }])
    await expect(listChatConversations()).resolves.toEqual([conversation])
    await expect(loadChatMessages('conv-1')).resolves.toEqual([turn])

    await deleteChatConversation('conv-1', 7)
    expect(history.getDeletes()).toEqual(['conv-1'])
    await expect(loadChatMessages('conv-1')).resolves.toEqual([])
  })
})
