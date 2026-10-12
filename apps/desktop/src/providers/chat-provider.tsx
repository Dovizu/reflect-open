import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { GraphInfo } from '@reflect/core'
import { invalidateChatQueries } from '@/lib/query-client.ts'
import { ChatContext, type ChatContextValue } from '@/providers/chat-context.tsx'
import { useAppServices } from '@/services/services-provider.tsx'

/**
 * One chat session per open graph (Plan 10): the conversation lives in a
 * `ChatSession` of this provider, not in the screen, so navigating away and
 * back keeps it. The session (`@reflect/core`) owns the turns, the composer
 * draft and attachments, sending, and persistence; this provider creates it
 * for the graph, keeps it attached while mounted, and publishes its state.
 */

export { useChatSession, type ChatStatus } from '@/providers/chat-context.tsx'

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
  const state = useSyncExternalStore(session.subscribe, session.getState)

  // The workspace tree is keyed by graph root, so switching graphs unmounts
  // this provider: detaching aborts the in-flight turn with it.
  useEffect(() => session.attach(), [session])

  // The history menus list conversations through React Query.
  useEffect(() => chatSessions.onConversationsChanged(invalidateChatQueries), [chatSessions])

  const value = useMemo<ChatContextValue>(
    () => ({
      ...state,
      selectModel: session.selectModel,
      setDraft: session.setDraft,
      attachImages: session.attachImages,
      removeAttachment: session.removeAttachment,
      send: session.send,
      stop: session.stop,
      newChat: session.newChat,
      openConversation: session.openConversation,
      deleteConversation: session.deleteConversation,
    }),
    [state, session],
  )
  return <ChatContext value={value}>{children}</ChatContext>
}
