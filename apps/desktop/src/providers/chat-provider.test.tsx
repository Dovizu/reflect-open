import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import {
  aiKeySecretName,
  type AiProviderConfig,
  type ChatTurn,
  type GraphInfo,
  type Settings,
} from '@reflect/core'
import {
  createTestAppServices,
  createTestChatEngineService,
  createTestChatHistoryService,
  createTestSecretStoreService,
  createTestSettingsService,
  type TestChatConversation,
} from '@reflect/core/testing'
import { queryClient, queryKeys } from '@/lib/query-client.ts'
import { ChatProvider, useChatSession } from '@/providers/chat-provider.tsx'
import { renderWithServices } from '@/test-utils/render-with-services.tsx'

/**
 * The provider as a shell over the core chat session: it creates the session
 * for its graph, keeps it attached while mounted, publishes its state and
 * controls through the context, and refreshes the chat history queries. The
 * session's own lifecycle is covered by `chat-session-service.test.ts`.
 */

const MODEL: AiProviderConfig = { id: 'm1', provider: 'openai', model: 'gpt-5.4', keyHint: '12345' }

const GRAPH: GraphInfo = { root: '/g', name: 'test-graph', generation: 1 }

const RESTORED_TURN: ChatTurn = {
  id: 'turn-old',
  userText: 'what did I write yesterday?',
  attachments: [],
  parts: [{ kind: 'text', text: 'Three notes.' }],
  responseMessages: [{ role: 'assistant', content: 'Three notes.' }],
  status: 'done',
}

let session: ReturnType<typeof useChatSession> | null = null

function SessionProbe(): ReactElement | null {
  session = useChatSession()
  return null
}

async function renderProvider(options?: {
  conversations?: readonly TestChatConversation[]
  settings?: Partial<Settings>
}) {
  session = null
  const settings = createTestSettingsService({
    aiProviders: [MODEL],
    defaultAiProviderId: 'm1',
    ...options?.settings,
  })
  await settings.whenLoaded()
  const chatHistory = createTestChatHistoryService(
    options?.conversations === undefined ? {} : { conversations: options.conversations },
  )
  const chatEngine = createTestChatEngineService([
    { type: 'text-delta', text: 'Hi.' },
    { type: 'complete', messages: [{ role: 'assistant', content: 'Hi.' }] },
  ])
  const app = createTestAppServices({
    settings,
    secretStore: createTestSecretStoreService({ [aiKeySecretName(MODEL.id)]: 'sk-test' }),
    chatHistory,
    chatEngine,
  })
  // The open graph, as the graph session service reports it.
  app.graphSession.setState({ graph: GRAPH, indexGeneration: 7 })
  const view = await renderWithServices(
    <ChatProvider graph={GRAPH}>
      <SessionProbe />
    </ChatProvider>,
    { app },
  )
  return { view, app, chatHistory, chatEngine }
}

describe('ChatProvider', () => {
  it('resumes the latest conversation of the graph on mount', async () => {
    await renderProvider({
      conversations: [
        {
          conversation: {
            id: 'conv-1',
            title: 'what did I write yesterday?',
            createdMs: 1,
            updatedMs: 0,
          },
          turns: [RESTORED_TURN],
        },
      ],
    })

    await vi.waitFor(() => expect(session?.turns).toEqual([RESTORED_TURN]))
    expect(session?.activeConversationId).toBe('conv-1')
  })

  it('publishes a sent turn and saves it under the index generation', async () => {
    const { chatHistory, chatEngine } = await renderProvider()

    await session?.send('hello there')

    await vi.waitFor(() => expect(session?.turns.at(-1)?.status).toBe('done'))
    expect(session?.turns.at(-1)).toMatchObject({
      userText: 'hello there',
      parts: [{ kind: 'text', text: 'Hi.' }],
    })
    expect(session?.status).toBe('idle')
    expect(chatEngine.calls()).toHaveLength(1)
    await vi.waitFor(() => expect(chatHistory.getSaves()).toHaveLength(2))
    expect(chatHistory.getSaves()[0]).toMatchObject({
      generation: 7,
      conversation: { id: session?.activeConversationId, title: 'hello there' },
    })
  })

  it('refreshes the chat history queries after a save', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    try {
      await renderProvider()

      await session?.send('hello')

      await vi.waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.chat.all }),
      )
    } finally {
      invalidate.mockRestore()
    }
  })

  it('holds the composer draft and clears it when a send goes through', async () => {
    await renderProvider()

    session?.setDraft('half-typed question')
    await vi.waitFor(() => expect(session?.draft).toBe('half-typed question'))

    await session?.send('half-typed question')
    await vi.waitFor(() => expect(session?.draft).toBe(''))
    expect(session?.turns.at(-1)?.userText).toBe('half-typed question')
  })

  it('persists a picked model and applies it to the session', async () => {
    const { app } = await renderProvider()
    expect(session?.activeModel).toEqual(MODEL)

    session?.selectModel({ configId: 'm1', modelId: 'gpt-5.5' })

    await vi.waitFor(() => expect(session?.activeModel).toEqual({ ...MODEL, model: 'gpt-5.5' }))
    expect(app.settings.get().chatModelSelection).toEqual({ configId: 'm1', modelId: 'gpt-5.5' })
  })

  it('aborts the in-flight turn when it unmounts (graph switch)', async () => {
    const { view, chatEngine } = await renderProvider()
    let signal: AbortSignal | undefined
    chatEngine.setScript(async function* (request) {
      signal = request.signal
      yield { type: 'text-delta', text: 'Hi' }
      // Never settles — the turn only ends through the abort signal.
      await new Promise<never>(() => {})
    })

    void session?.send('hey')
    await vi.waitFor(() => expect(signal).toBeDefined())
    expect(signal?.aborted).toBe(false)

    await view.unmount()
    expect(signal?.aborted).toBe(true)
  })
})
