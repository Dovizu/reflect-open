import type { ClockService } from '../app/clock-service.ts'
import type { IdService } from '../app/id-service.ts'
import type { ImageCodecService } from '../app/image-codec-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { AiCredentialService } from '../ai/ai-credential-service.ts'
import type { AiProviderConfigService } from '../ai/ai-provider-config-service.ts'
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
import {
  createChatSessionService,
  type ChatSessionService,
} from '../ai/chat/chat-session-service.ts'
import {
  createNoteToolsService,
  type DailyNoteQueries,
  type NoteToolsService,
} from '../ai/chat/note-tools-service.ts'
import type { ChatTurn } from '../ai/chat/transcript.ts'
import type { EmbeddingRuntimeService } from '../embeddings/embedding-runtime-service.ts'
import type { RetrievalService } from '../embeddings/retrieval-service.ts'
import type { GraphSessionService } from '../graph/graph-session-service.ts'
import type { NoteFileService } from '../graph/note-file-service.ts'
import type { AssetReferences } from '../indexing/asset-refs.ts'
import type { NoteListService } from '../indexing/note-list-service.ts'
import {
  cloudSafeGraphContext,
  type CloudGraphContext,
  type CloudSafe,
  type PrivacyService,
} from '../privacy/privacy-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import type { XArchiveService } from '../x-archive.ts'
import { createTestAiCredentialService, createTestAiProviderConfigService } from './ai.ts'
import { createTestXArchiveService } from './capture.ts'
import { createTestClockService } from './clock.ts'
import { createTestEmbeddingRuntimeService, createTestRetrievalService } from './embeddings.ts'
import { createTestNoteFileService } from './graph.ts'
import { createTestGraphSessionService } from './graph-session.ts'
import { createTestIdService } from './id.ts'
import { createTestImageCodec } from './image-codec.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestPrivacyService } from './privacy.ts'
import { createTestSettingsService } from './settings.ts'

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

export interface TestNoteToolsServiceOptions {
  /** Answers `search_notes`; defaults to a retrieval service with no hits. */
  retrieval?: Pick<RetrievalService, 'retrieve'>
  /** The notes and the asset descriptions; defaults to an empty test note file service. */
  noteFile?: Pick<NoteFileService, 'read'>
  /** Answers `list_recent_notes`; defaults to no notes. */
  noteList?: Pick<NoteListService, 'listRecentNotes'>
  /** Answers `list_daily_notes`; defaults to no days. */
  dailyNotes?: DailyNoteQueries
  /** The notes that reference an asset; defaults to none. */
  assetReferences?: Pick<AssetReferences, 'notePaths'>
  /** The X archive owners of an asset; defaults to an empty test X archive. */
  xArchive?: Pick<XArchiveService, 'owners'>
  /** The privacy gate; defaults to a test privacy service over `noteFile`. */
  privacy?: PrivacyService
}

/** The real {@link NoteToolsService} over test doubles. */
export function createTestNoteToolsService(
  options?: TestNoteToolsServiceOptions,
): NoteToolsService {
  const noteFile = options?.noteFile ?? createTestNoteFileService()
  return createNoteToolsService({
    retrieval: options?.retrieval ?? createTestRetrievalService(),
    noteFile,
    noteList: options?.noteList ?? { listRecentNotes: async () => [] },
    dailyNotes: options?.dailyNotes ?? { listDailyNotes: async () => [] },
    assetReferences: options?.assetReferences ?? { notePaths: async () => [] },
    xArchive: options?.xArchive ?? createTestXArchiveService(),
    privacy: options?.privacy ?? createTestPrivacyService({ noteFile }),
  })
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

export interface TestChatSessionServiceOptions {
  /** Runs the turns; defaults to a test chat engine. */
  chatEngine?: ChatEngineService
  /** The persisted conversations; defaults to an empty test chat history. */
  chatHistory?: ChatHistoryService
  /** Loads the graph overview; defaults to a test chat graph context service. */
  chatGraphContext?: ChatGraphContextService
  /** The settings the session reads; defaults to an empty test settings service. */
  settings?: SettingsService
  /** Holds the keys; defaults to a credential service over an empty test secret store. */
  credentials?: AiCredentialService
  /** The configured entries; defaults to a provider config service over `settings` and `credentials`. */
  providerConfig?: AiProviderConfigService
  /** The embedding runtime; defaults to a test runtime that is `ready`. */
  embeddingRuntime?: EmbeddingRuntimeService
  /** The open graph; defaults to a test graph session service. */
  graphSession?: Pick<GraphSessionService, 'getState' | 'subscribe'>
  clock?: ClockService
  id?: IdService
  imageCodec?: ImageCodecService
  logger?: LoggerService
}

/** The real {@link ChatSessionService} over test doubles. */
export function createTestChatSessionService(
  options?: TestChatSessionServiceOptions,
): ChatSessionService {
  const settings = options?.settings ?? createTestSettingsService()
  const credentials = options?.credentials ?? createTestAiCredentialService()
  const id = options?.id ?? createTestIdService()
  return createChatSessionService({
    chatEngine: options?.chatEngine ?? createTestChatEngineService(),
    chatHistory: options?.chatHistory ?? createTestChatHistoryService(),
    chatGraphContext: options?.chatGraphContext ?? createTestChatGraphContextService(),
    providerConfig:
      options?.providerConfig ?? createTestAiProviderConfigService({ settings, credentials, id }),
    credentials,
    embeddingRuntime: options?.embeddingRuntime ?? createTestEmbeddingRuntimeService(),
    settings,
    graphSession: options?.graphSession ?? createTestGraphSessionService(),
    clock: options?.clock ?? createTestClockService(),
    id,
    imageCodec: options?.imageCodec ?? createTestImageCodec(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}
