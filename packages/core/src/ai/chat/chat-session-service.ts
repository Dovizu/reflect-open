import type { ClockService } from '../../app/clock-service.ts'
import type { IdService } from '../../app/id-service.ts'
import type { ImageCodecService } from '../../app/image-codec-service.ts'
import type { LoggerService } from '../../app/logger-service.ts'
import type { EmbeddingRuntimeService } from '../../embeddings/embedding-runtime-service.ts'
import { errorMessage } from '../../errors.ts'
import type { GraphSession } from '../../app/graph-session.ts'
import type { Unlisten } from '../../ipc/ipc-service.ts'
import type { AiProviderConfig, ChatModelSelection, Settings } from '../../settings/schema.ts'
import type { SettingsService } from '../../settings/settings-service.ts'
import type { AiCredentialService } from '../ai-credential-service.ts'
import type { AiProviderConfigService } from '../ai-provider-config-service.ts'
import { readChatAttachment } from './chat-attachments.ts'
import type { ChatEngineService, ChatStreamEvent } from './chat-engine-service.ts'
import type { ChatGraphContextService } from './chat-graph-context-service.ts'
import type { ChatConversation, ChatHistoryService } from './chat-history-service.ts'
import type { ChatModelOption } from './model-options.ts'
import {
  appendEvent,
  buildHistory,
  userMessage,
  type ChatAttachment,
  type ChatTurn,
} from './transcript.ts'

/**
 * One chat session per open graph (Plan 10): the conversation lives here, not
 * in the screen, so navigating away and back keeps it. The state is just
 * {@link ChatTurn}s — what each turn renders and what it contributed to the
 * model history are one record, and the history a new turn resends is derived
 * from them.
 *
 * Conversations persist to the graph's index DB (the `ChatHistoryService`):
 * each turn is saved when sent (the user half) and again when it settles, so
 * a relaunch restores the conversation exactly. When the session attaches,
 * the latest conversation is resumed unless it has been idle past
 * {@link CHAT_IDLE_CUTOFF_MS} — then a fresh one starts and the old one stays
 * in the history. Persistence is best-effort: a failed save logs and the
 * in-memory conversation carries on.
 */

/** Resume the latest conversation within this window; otherwise start fresh. */
export const CHAT_IDLE_CUTOFF_MS = 6 * 60 * 60 * 1000

const TITLE_MAX_CHARS = 60

/** Title for a conversation row: its first message, cut to list length. */
export function conversationTitle(firstUserText: string): string {
  const trimmed = firstUserText.trim().replaceAll(/\s+/g, ' ')
  if (trimmed === '') {
    return 'New chat'
  }
  return trimmed.length > TITLE_MAX_CHARS ? `${trimmed.slice(0, TITLE_MAX_CHARS)}…` : trimmed
}

export type ChatStatus = 'idle' | 'streaming'

/** What a {@link ChatSession} publishes. Replaced, never mutated, on every change. */
export interface ChatSessionState {
  turns: ChatTurn[]
  status: ChatStatus
  /** Configured provider entries (empty → the add-a-provider CTA). */
  providers: AiProviderConfig[]
  /** Every model the picker offers: each provider's full curated list. */
  modelOptions: ChatModelOption[]
  /**
   * The provider entry + model the next turn calls (`model` already carries
   * the picker's choice) — the persisted last pick or the settings default.
   */
  activeModel: AiProviderConfig | null
  /**
   * The composer's unsent text. Session state, not composer state, so it
   * survives the screen unmounting. Cleared by a send that goes through.
   */
  draft: string
  /** Images queued for the next message (dropped or pasted onto the chat). */
  attachments: ChatAttachment[]
  /** The persisted conversation the transcript belongs to. */
  activeConversationId: string
}

/**
 * The chat session of one open graph. Members are function properties so
 * surfaces can pass them around unbound.
 */
export interface ChatSession {
  getState: () => ChatSessionState
  subscribe: (listener: () => void) => Unlisten
  /**
   * Start the session's background work: resume the latest conversation of
   * the graph (when its index is open) and follow the
   * embedding runtime status. The returned function stops both and aborts
   * the in-flight turn — a turn must die with its graph, or its tools would
   * keep reading whichever graph is open *now* and ship that content to the
   * provider under the old conversation.
   */
  attach: () => Unlisten
  /**
   * Pick the chat model. Persisted (`chatModelSelection` in the settings
   * document), so later sessions start on it; null returns to the app
   * default.
   */
  selectModel: (selection: ChatModelSelection | null) => void
  /** Replace the composer draft. */
  setDraft: (text: string) => void
  /** Queue image files for the next message. */
  attachImages: (files: File[]) => Promise<void>
  /** Drop one queued image. */
  removeAttachment: (id: string) => void
  /** Send one user message (text, queued images, or both) and stream the turn. */
  send: (text: string) => Promise<void>
  /** Abort the in-flight turn (partial text stays in the transcript). */
  stop: () => void
  /** Leave the conversation in the history and start a fresh one. */
  newChat: () => void
  /** Load a past conversation from the history. */
  openConversation: (id: string) => Promise<void>
  /** Delete a conversation; deleting the active one starts a fresh chat. */
  deleteConversation: (id: string) => Promise<void>
}

export interface ChatSessionOptions {
  /** The graph session: `name` titles the prompt's overview block; chat writes pin to its index generation. */
  session: GraphSession
}

/** Creates the chat session of an open graph and reports history changes. */
export interface ChatSessionService {
  /** A fresh session for `options.session`. It does nothing until it is attached. */
  create: (options: ChatSessionOptions) => ChatSession
  /**
   * Calls `listener` after any session saved a turn or deleted a
   * conversation: the persisted conversation list may have changed.
   */
  onConversationsChanged: (listener: () => void) => Unlisten
}

interface LocalState {
  turns: ChatTurn[]
  draft: string
  attachments: ChatAttachment[]
  conversationId: string
}

export function createChatSessionService(deps: {
  chatEngine: ChatEngineService
  chatHistory: ChatHistoryService
  chatGraphContext: ChatGraphContextService
  providerConfig: Pick<
    AiProviderConfigService,
    'list' | 'chatModelOptions' | 'chatModel' | 'selectChatModel'
  >
  credentials: Pick<AiCredentialService, 'read'>
  embeddingRuntime: Pick<EmbeddingRuntimeService, 'status' | 'subscribe' | 'lastStatus'>
  settings: Pick<SettingsService, 'get' | 'subscribe'>
  clock: Pick<ClockService, 'now' | 'today'>
  id: Pick<IdService, 'uuid'>
  imageCodec: Pick<ImageCodecService, 'decode'>
  logger: Pick<LoggerService, 'error'>
}): ChatSessionService {
  const {
    chatEngine,
    chatHistory,
    chatGraphContext,
    providerConfig,
    credentials,
    embeddingRuntime,
    settings,
    clock,
    id,
    imageCodec,
    logger,
  } = deps

  const conversationListeners = new Set<() => void>()
  const emitConversationsChanged = (): void => {
    for (const listener of conversationListeners) {
      listener()
    }
  }

  function create(options: ChatSessionOptions): ChatSession {
    const { session: graph } = options

    let local: LocalState = {
      turns: [],
      draft: '',
      attachments: [],
      conversationId: id.uuid(),
    }

    const listeners = new Set<() => void>()
    let stopSettings: Unlisten | null = null
    // The published state, rebuilt lazily: `null` after a local change, and
    // stale once the settings document it was derived from is replaced.
    let snapshot: { state: ChatSessionState; settings: Settings } | null = null
    let modelOptions: { providers: AiProviderConfig[]; options: ChatModelOption[] } | null = null

    const notify = (): void => {
      for (const listener of listeners) {
        listener()
      }
    }

    const update = (patch: Partial<LocalState>): void => {
      local = { ...local, ...patch }
      snapshot = null
      notify()
    }

    const setTurns = (updater: (current: ChatTurn[]) => ChatTurn[]): void => {
      update({ turns: updater(local.turns) })
    }

    const getState = (): ChatSessionState => {
      const currentSettings = settings.get()
      if (snapshot?.settings !== currentSettings) {
        const providers = providerConfig.list()
        if (modelOptions?.providers !== providers) {
          modelOptions = { providers, options: providerConfig.chatModelOptions() }
        }
        snapshot = {
          settings: currentSettings,
          state: {
            turns: local.turns,
            status: local.turns.at(-1)?.status === 'streaming' ? 'streaming' : 'idle',
            providers,
            modelOptions: modelOptions.options,
            // The picker's choice lives in the settings document, not session
            // state, so the model used last is the one the next session starts on.
            activeModel: providerConfig.chatModel(),
            draft: local.draft,
            attachments: local.attachments,
            activeConversationId: local.conversationId,
          },
        }
      }
      return snapshot.state
    }

    const subscribe = (listener: () => void): Unlisten => {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver = (): void => {
        listener()
      }
      listeners.add(deliver)
      stopSettings ??= settings.subscribe(notify)
      return () => {
        listeners.delete(deliver)
        if (listeners.size === 0) {
          stopSettings?.()
          stopSettings = null
        }
      }
    }

    // The graph's index session generation, echoed by every chat write: a
    // session winding down after its graph was replaced keeps it, so its late
    // saves no-op in Rust instead of landing in the graph that is open now.
    const generation = graph.indexGeneration

    // The in-flight send, tracked synchronously — the no-concurrent-sends
    // guard can't ride on published state. `session` ties a send to its
    // conversation: New chat bumps the counter, so a detached send winding
    // down no longer counts as "this conversation is busy" and never clears a
    // successor's slot.
    let sessionCounter = 0
    let activeSend: { controller: AbortController; session: number } | null = null
    // The session of the most recent send — unlike `activeSend` this is not
    // cleared when the turn settles, so a pending conversation switch can tell
    // that the on-screen conversation received a message even after the stream
    // finished.
    let lastSendSession = -1

    // Conversations deleted this session: a settle-time save landing after its
    // conversation was deleted would re-create the row via the upsert.
    const deletedConversations = new Set<string>()
    // The tail of each conversation's save chain. Saves are serialized per
    // conversation so a delete can wait for in-flight saves to land first —
    // two independent IPC commands carry no ordering guarantee in Rust.
    const pendingSaves = new Map<string, Promise<void>>()

    /**
     * Persist one turn into its conversation, best-effort: the generation it
     * was issued under gates the write in Rust (a stale save no-ops), deleted
     * conversations are never resurrected — the guard runs again when the
     * save's turn in the chain comes up, not just at enqueue time — and a
     * failure logs without touching the in-memory conversation.
     */
    const persistTurn = (conversation: ChatConversation, turn: ChatTurn, createdMs: number) => {
      const saveGeneration = generation
      if (saveGeneration === null || deletedConversations.has(conversation.id)) {
        return
      }
      const chained = (pendingSaves.get(conversation.id) ?? Promise.resolve())
        .then(async () => {
          if (deletedConversations.has(conversation.id)) {
            return
          }
          await chatHistory.saveTurn({ conversation, turn, createdMs, generation: saveGeneration })
          emitConversationsChanged()
        })
        .catch((cause: unknown) => {
          logger.error('chat: saving the turn failed:', errorMessage(cause))
        })
      pendingSaves.set(conversation.id, chained)
    }

    // Resume the latest conversation — unless it has been idle past the
    // cutoff (then the next message starts a fresh one and the old chat stays
    // in the history). Guarded against races: by the time the rows arrive the
    // user may have started typing into the fresh conversation.
    const resume = async (attempt: { active: boolean }): Promise<void> => {
      const session = sessionCounter
      try {
        const [latest] = await chatHistory.listRecent(1)
        if (latest === undefined || clock.now() - latest.updatedMs > CHAT_IDLE_CUTOFF_MS) {
          return
        }
        const restored = await chatHistory.loadConversation(latest.id)
        if (!attempt.active || session !== sessionCounter || local.turns.length > 0) {
          return
        }
        update({ conversationId: latest.id, turns: restored })
      } catch (cause) {
        logger.error('chat: restoring the last conversation failed:', errorMessage(cause))
      }
    }

    const attach = (): Unlisten => {
      const attempt = { active: true }
      if (generation !== null) {
        void resume(attempt)
      }
      // Without a loaded embedding model the search tool must *say* it is
      // lexical, so the runtime status is kept fresh while the session lives.
      const stopEmbed = embeddingRuntime.subscribe(() => {})
      void embeddingRuntime.status()
      return () => {
        stopEmbed()
        attempt.active = false
        activeSend?.controller.abort()
      }
    }

    const send = async (text: string): Promise<void> => {
      const trimmed = text.trim()
      const attached = local.attachments
      const config = providerConfig.chatModel()
      if (
        (trimmed === '' && attached.length === 0) ||
        config === null ||
        activeSend?.session === sessionCounter
      ) {
        return
      }
      const turnsBefore = local.turns
      update({ draft: '', attachments: [] })

      const turnId = id.uuid()
      const messages = [...buildHistory(turnsBefore), userMessage(trimmed, attached)]
      const customSystemPrompt = settings.get().chatSystemPrompt
      // Everything the settle-time save needs, captured now: a turn detached
      // by New chat (or a conversation switch) still persists into the
      // conversation it was sent under.
      const sendConversationId = local.conversationId
      const turnCreatedMs = clock.now()
      const title = conversationTitle(turnsBefore[0]?.userText ?? trimmed)
      const conversationMeta = (): ChatConversation => ({
        id: sendConversationId,
        title,
        createdMs: turnCreatedMs,
        updatedMs: clock.now(),
      })
      // The turn is folded locally alongside the published state — the settle
      // save must not depend on the turn still being part of `turns`.
      let localTurn: ChatTurn = {
        id: turnId,
        userText: trimmed,
        attachments: attached,
        parts: [],
        responseMessages: [],
        status: 'streaming',
      }

      const updateTurn = (updater: (turn: ChatTurn) => ChatTurn) => {
        localTurn = updater(localTurn)
        setTurns((current) => current.map((turn) => (turn.id === turnId ? updater(turn) : turn)))
      }
      const applyEvent = (event: ChatStreamEvent) => {
        updateTurn((turn) => ({ ...turn, parts: appendEvent(turn.parts, event) }))
      }

      const initialTurn = localTurn
      setTurns((current) => [...current, initialTurn])
      // The user half lands immediately, so a crash mid-stream keeps the
      // question (restored with an empty response, which the model history
      // derivation already omits).
      persistTurn(conversationMeta(), localTurn, turnCreatedMs)

      const controller = new AbortController()
      const sending = { controller, session: sessionCounter }
      activeSend = sending
      lastSendSession = sending.session

      try {
        // The graph overview degrades to null (prompt without the block)
        // rather than blocking the turn — a cold index shouldn't kill chat.
        const [apiKey, context] = await Promise.all([
          credentials.read(config),
          chatGraphContext.load(graph.name).catch((cause: unknown) => {
            logger.error('chat graph context failed:', errorMessage(cause))
            return null
          }),
        ])
        if (apiKey === null) {
          applyEvent({
            type: 'error',
            message: 'No API key found for this provider — re-add it in Settings → AI providers.',
            messages: [],
          })
          return
        }
        const events = chatEngine.streamTurn({
          config,
          apiKey,
          messages,
          today: clock.today(),
          // A stray enabled flag must lose to the runtime here.
          semanticSearchEnabled:
            settings.get().semanticSearchEnabled &&
            embeddingRuntime.lastStatus().status === 'ready',
          customSystemPrompt,
          context,
          signal: controller.signal,
        })
        for await (const event of events) {
          // Every terminal event carries the turn's messages — for a stopped or
          // failed turn that's the completed steps plus partial text, so the
          // derived history matches what stayed on screen.
          if (event.type === 'complete' || event.type === 'aborted' || event.type === 'error') {
            updateTurn((turn) => ({ ...turn, responseMessages: event.messages }))
          }
          // `complete` is folded too: appendEvent backstops a reply-less turn
          // with a notice, so the chips never settle into silence.
          applyEvent(event)
        }
      } catch (cause) {
        // The engine normalizes its own failures; this guards the seams around
        // it (keychain read, event application) so the UI never sticks.
        applyEvent({ type: 'error', message: errorMessage(cause), messages: [] })
      } finally {
        updateTurn((turn) => ({ ...turn, status: 'done' }))
        persistTurn(conversationMeta(), localTurn, turnCreatedMs)
        // Only release the slot if it's still ours: a turn detached by New
        // chat must not, while winding down, unhook the controller a newer
        // turn has since registered — Stop and the detach abort always have
        // to target the live stream.
        if (activeSend === sending) {
          activeSend = null
        }
      }
    }

    const stop = (): void => {
      activeSend?.controller.abort()
    }

    const newChat = (): void => {
      activeSend?.controller.abort()
      sessionCounter += 1
      update({ turns: [], attachments: [], conversationId: id.uuid() })
    }

    const openConversation = async (conversationId: string): Promise<void> => {
      if (conversationId === local.conversationId) {
        return
      }
      activeSend?.controller.abort()
      sessionCounter += 1
      const session = sessionCounter
      update({ attachments: [] })
      try {
        const restored = await chatHistory.loadConversation(conversationId)
        // Superseded by another switch or New chat — or by a send: a message
        // composed while the rows loaded belongs to the conversation that was
        // on screen, so the user's turn must not be swapped out from under it.
        // Checked via the last send's session (not the in-flight slot, which
        // is cleared on settle) — a turn that finished streaming before the
        // rows arrived still anchors the switch to the conversation it's in.
        if (session !== sessionCounter || lastSendSession === session) {
          return
        }
        update({ conversationId, turns: restored })
      } catch (cause) {
        logger.error('chat: opening the conversation failed:', errorMessage(cause))
      }
    }

    const deleteConversation = async (conversationId: string): Promise<void> => {
      deletedConversations.add(conversationId)
      const deleteGeneration = generation
      if (deleteGeneration !== null) {
        // Let any in-flight save for this conversation land first — the
        // delete and a dispatched save are independent commands, so issuing
        // the delete now could be overtaken in Rust and the save's upsert
        // would resurrect the row. (The chain never rejects.)
        await pendingSaves.get(conversationId)
        try {
          await chatHistory.deleteConversation(conversationId, deleteGeneration)
        } catch (cause) {
          logger.error('chat: deleting the conversation failed:', errorMessage(cause))
        }
        emitConversationsChanged()
      }
      if (conversationId === local.conversationId) {
        newChat()
      }
    }

    const attachImages = async (files: File[]): Promise<void> => {
      // Reading files is async: a drop still in flight when New chat clears
      // the session must not land in the fresh composer afterwards.
      const session = sessionCounter
      const queued = await Promise.all(
        files.map((file) => readChatAttachment({ imageCodec, id }, file)),
      )
      if (session !== sessionCounter) {
        return
      }
      update({ attachments: [...local.attachments, ...queued] })
    }

    return {
      getState,
      subscribe,
      attach,
      selectModel: (selection) => {
        providerConfig.selectChatModel(selection)
      },
      setDraft: (text) => {
        update({ draft: text })
      },
      attachImages,
      removeAttachment: (attachmentId) => {
        update({
          attachments: local.attachments.filter((attachment) => attachment.id !== attachmentId),
        })
      },
      send,
      stop,
      newChat,
      openConversation,
      deleteConversation,
    }
  }

  return {
    create,
    onConversationsChanged: (listener) => {
      // Wrapped for identity, so one function added twice detaches independently.
      const deliver = (): void => {
        listener()
      }
      conversationListeners.add(deliver)
      return () => {
        conversationListeners.delete(deliver)
      }
    },
  }
}
