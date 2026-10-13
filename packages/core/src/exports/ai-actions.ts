export {
  AI_PROVIDERS,
  aiProvider,
  aiModelLabel,
  aiProviderRequiresApiKey,
  type AiProviderInfo,
  type AiModelOption,
} from '../ai/provider-catalog.ts'
export { aiKeySecretName } from '../ai/ai-credential-service.ts'
export {
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  isPlainHttpRemoteBaseUrl,
} from '../ai/openai-compatible.ts'
export { isHttpBaseUrl } from '../lib/http-url.ts'

export { TRANSCRIPTION_PROVIDERS } from '../ai/provider-config.ts'
export {
  chatModelOptions,
  type ChatModelOption,
  type ChatModelSelection,
} from '../ai/chat/model-options.ts'
export { type CloudGraphContext, type CloudSafe } from '../privacy/checkers.ts'
export { type NoteHitSummary } from '../ai/chat/note-tools-service.ts'
export { chatSystemPrompt } from '../ai/chat/system-prompt.ts'
export type { ChatStreamEvent } from '../ai/chat/chat-engine-service.ts'
export {
  type ChatSession,
  type ChatSessionState,
  type ChatStatus,
} from '../ai/chat/chat-session-service.ts'
export { readChatAttachment } from '../ai/chat/chat-attachments.ts'
export { filterAiPrompts } from '../ai/selection-prompts.ts'
export {
  isToolPending,
  type AssistantPart,
  type ChatAttachment,
  type ChatTurn,
} from '../ai/chat/transcript.ts'
export { type ChatConversation } from '../ai/chat/chat-history-service.ts'
export { audioMemoIdentity, audioMemoPartPath } from '../audio/audio-memo.ts'
export {
  type AudioMemoPhase,
  type AudioMemoService,
  type AudioMemoSession,
  type AudioMemoSessionState,
} from '../audio/audio-memo-service.ts'
export {
  type MobileAudioMemoService,
  type MobileAudioMemoSession,
  type MobileAudioMemoSessionState,
} from '../audio/mobile-audio-memo-service.ts'
export {
  captureAckSchema,
  captureWireMessageSchema,
  type CaptureWireMessage,
} from '../capture/capture-envelope.ts'
export {
  canReadCalendars,
  calendarEventSchema,
  type CalendarAuthorizationStatus,
  type CalendarInfo,
  type CalendarEvent,
} from '../calendar/commands.ts'
export { dayRange, displayEvents, defaultAttendees } from '../calendar/events.ts'
export { type MeetingAttendee } from '../contacts/meeting-service.ts'
