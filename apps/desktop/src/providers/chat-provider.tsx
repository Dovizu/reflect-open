import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { ChatSession, ChatSessionState, GraphInfo } from '@reflect/core'
import { invalidateChatQueries } from '@/lib/query-client.ts'
import { useAppServices } from '@/services/services-provider.tsx'
import { useServiceState } from '@/services/use-service-state.ts'

/**
 * One chat session per open graph (Plan 10): the conversation lives in a
 * `ChatSession` of this provider, not in the screen, so navigating away and
 * back keeps it. The session (`@reflect/core`) owns the turns, the composer
 * draft and attachments, sending, and persistence; this provider creates it
 * for the graph, keeps it attached while mounted, and publishes its state.
 */

export type { ChatStatus } from '@reflect/core'

type ChatContextValue = ChatSessionState & Omit<ChatSession, 'getState' | 'subscribe' | 'attach'>

const ChatContext = createContext<ChatContextValue | null>(null)

interface ChatProviderProps {
  /** The open graph — names the prompt's overview block. */
  graph: GraphInfo
  children: ReactNode
}

export function ChatProvider({ graph, children }: ChatProviderProps): ReactElement {
  const { chatSessions } = useAppServices()
  const [session] = useState(() =>
    chatSessions.create({ graph: { root: graph.root, name: graph.name } }),
  )
  const state = useServiceState(session)

  // The workspace tree is keyed by graph root, so switching graphs unmounts
  // this provider: detaching aborts the in-flight turn with it.
  useEffect(() => session.attach(), [session])

  // The history menus list conversations through React Query.
  useEffect(() => chatSessions.onConversationsChanged(invalidateChatQueries), [chatSessions])

  const value = useMemo<ChatContextValue>(() => ({ ...session, ...state }), [state, session])
  return <ChatContext value={value}>{children}</ChatContext>
}

/** Access the chat session. Use within a ChatProvider. */
export function useChatSession(): ChatContextValue {
  const context = use(ChatContext)
  if (!context) {
    throw new Error('useChatSession must be used within a ChatProvider')
  }
  return context
}
