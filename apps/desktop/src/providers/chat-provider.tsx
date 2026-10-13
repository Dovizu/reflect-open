import { useMemo } from 'react'
import type { ChatSession, ChatSessionState } from '@reflect/core'
import { useGraphServices } from '@/services/services-provider.tsx'
import { useServiceState } from '@/services/use-service-state.ts'

/**
 * The chat session of the open graph (Plan 10): the conversation lives in the
 * graph's `ChatSession`, not in the screen, so navigating away and back keeps
 * it. The session (`@reflect/core`) owns the turns, the composer draft and
 * attachments, sending, and persistence.
 */

export type { ChatStatus } from '@reflect/core'

type ChatContextValue = ChatSessionState & Omit<ChatSession, 'getState' | 'subscribe' | 'attach'>

const NO_CHAT = {
  subscribe: () => () => {},
  getState: (): ChatSessionState | null => null,
}

/** The chat session of the open graph; `optional` allows none (no graph is open). */
export function useChatSession(options: { optional: true }): ChatContextValue | null
export function useChatSession(): ChatContextValue
export function useChatSession(options?: { optional: true }): ChatContextValue | null { // FIXME: let I said in earlier, function overriding is anti-pattern. Just create two functions.
  const session = useGraphServices({ optional: true })?.chat ?? null
  const state = useServiceState<ChatSessionState | null>(session ?? NO_CHAT)
  const value = useMemo(
    () => (session === null || state === null ? null : { ...session, ...state }),
    [state, session],
  )
  if (value === null && options?.optional !== true) {
    throw new Error('useChatSession must be used while a graph is open')
  }
  return value
}
