import type {
  ChatEngineService,
  ChatStreamEvent,
  ChatTurnRequest,
} from '../ai/chat/chat-engine-service.ts'
import type { ChatGraphContextService } from '../ai/chat/chat-graph-context-service.ts'
import type {
  ChatConversation,
  ChatHistoryService,
  SaveChatTurnInput,
} from '../ai/chat/chat-history-service.ts'
import type { ChatTurn } from '../ai/chat/transcript.ts'
import {
  cloudSafeGraphContext,
  type CloudGraphContext,
  type CloudSafe,
} from '../privacy/privacy-service.ts'

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

/** The events of a turn, or a function that answers each `streamTurn` call. */
export type TestChatTurnScript =
  | readonly ChatStreamEvent[]
  | ((request: ChatTurnRequest) => Iterable<ChatStreamEvent> | AsyncIterable<ChatStreamEvent>)

export interface TestChatEngineService extends ChatEngineService {
  /** Every `streamTurn` request, in order. */
  calls(): readonly ChatTurnRequest[]
  /** Replaces the script that later `streamTurn` calls play. */
  setScript(script: TestChatTurnScript): void
}

/**
 * A {@link ChatEngineService} that plays `script` for every turn, without a
 * model or tools. By default a turn completes with no messages.
 */
export function createTestChatEngineService(
  script: TestChatTurnScript = [{ type: 'complete', messages: [] }],
): TestChatEngineService {
  let current = script
  const log: ChatTurnRequest[] = []
  return {
    async *streamTurn(request) {
      log.push(request)
      yield* typeof current === 'function' ? current(request) : current
    },
    calls: () => [...log],
    setScript(next) {
      current = next
    },
  }
}

/** A graph overview, or a function that answers each `load` call. */
export type TestChatGraphContextSource =
  | CloudGraphContext
  | ((graphName: string) => CloudGraphContext | Promise<CloudGraphContext>)

export interface TestChatGraphContextService extends ChatGraphContextService {
  /** The graph name of every `load` call, in order. */
  calls(): readonly string[]
  /** Replaces the overview that later `load` calls answer with. */
  setResult(result: TestChatGraphContextSource): void
}

/**
 * A {@link ChatGraphContextService} that answers `result` without reading an
 * index: by default the overview of an empty graph with the requested name.
 */
export function createTestChatGraphContextService(
  result?: TestChatGraphContextSource,
): TestChatGraphContextService {
  let source: TestChatGraphContextSource =
    result ??
    ((graphName) => ({
      graphName,
      noteCount: 0,
      dailyNoteCount: 0,
      earliestDailyDate: null,
      latestDailyDate: null,
      tags: [],
      tagsTruncated: false,
    }))
  const log: string[] = []
  return {
    load: async (graphName): Promise<CloudSafe<CloudGraphContext>> => {
      log.push(graphName)
      return cloudSafeGraphContext(typeof source === 'function' ? await source(graphName) : source)
    },
    calls: () => [...log],
    setResult(next) {
      source = next
    },
  }
}
