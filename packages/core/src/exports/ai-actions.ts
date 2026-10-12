export {
  AI_PROVIDERS,
  aiProvider,
  aiModelLabel,
  aiProviderRequiresApiKey,
  DEFAULT_CONTEXT_WINDOW,
  modelContextWindow,
  type AiProviderInfo,
  type AiModelOption,
} from '../ai/provider-catalog.ts'
export { aiKeySecretName, aiApiKeyForConfig } from '../ai/secrets.ts'
export {
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  isPlainHttpRemoteBaseUrl,
  OPENAI_COMPATIBLE_PROVIDER_ID,
} from '../ai/openai-compatible.ts'
export { isHttpBaseUrl, normalizeOpenAICompatibleBaseUrl } from '../lib/http-url.ts'
export { setSecret, getSecret, deleteSecret } from '../secrets/keychain.ts'
export {
  KEY_HINT_LENGTH,
  TRANSCRIPTION_PROVIDERS,
  apiKeyHint,
  withAiProviderAdded,
  withAiProviderRemoved,
  defaultAiProvider,
  pickTranscriptionConfig,
  type AiProvidersState,
  type TranscriptionConfig,
  type TranscriptionProvider,
} from '../ai/provider-config.ts'
export {
  chatModelOptions,
  resolveChatModel,
  type ChatModelOption,
  type ChatModelSelection,
} from '../ai/chat/model-options.ts'
export {
  validateApiKey,
  type ApiKeyValidation,
  type ApiKeyValidationInput,
} from '../ai/validate-key.ts'
export {
  assertCloudAllowed,
  cloudSafeAssetDescription,
  cloudSafeGraphContext,
  cloudSafeNoteContent,
  cloudSafeSelection,
  isPrivateNoteError,
  PrivateNoteError,
  type CloudAssetDescription,
  type CloudGraphContext,
  type CloudNoteContent,
  type CloudNoteListing,
  type CloudSafe,
  type CloudSearchHit,
  type CloudSendable,
} from '../privacy/checkers.ts'
export {
  MAX_DAILY_NOTE_DAYS,
  type ListDailyNotesOutput,
  type ListRecentNotesOutput,
  type NoteHitSummary,
  type NoteToolCall,
  type NoteToolResult,
  type NoteTools,
  type ReadAssetSummary,
  type ReadNoteSummary,
  type SearchNotesOutput,
} from '../ai/chat/note-tools-service.ts'
export {
  MAX_NOTE_CONTENT_CHARS,
  MAX_READ_NOTES,
  type ReadNoteResult,
  type ReadNotesOutput,
} from '../ai/chat/read-notes.ts'
export {
  MAX_ASSET_DESCRIPTION_CHARS,
  MAX_READ_ASSETS,
  type ReadAssetResult,
  type ReadAssetsOutput,
} from '../ai/chat/read-assets.ts'
export { chatSystemPrompt, type SystemPromptInput } from '../ai/chat/system-prompt.ts'
export { MAX_CONTEXT_TAGS } from '../ai/chat/chat-graph-context-service.ts'
export type { ChatStreamEvent, ChatTurnRequest } from '../ai/chat/chat-engine-service.ts'
export {
  conversationTitle,
  type ChatSession,
  type ChatSessionOptions,
  type ChatSessionState,
  type ChatStatus,
} from '../ai/chat/chat-session-service.ts'
export { readChatAttachment } from '../ai/chat/chat-attachments.ts'
export {
  BUILT_IN_AI_PROMPTS,
  filterAiPrompts,
  renderSelectionPrompt,
} from '../ai/selection-prompts.ts'
export {
  appendEvent,
  buildHistory,
  isToolPending,
  NO_REPLY_NOTICE,
  userMessage,
  type AssistantPart,
  type ChatAttachment,
  type ChatTurn,
} from '../ai/chat/transcript.ts'
export {
  deleteChatConversation,
  listChatConversations,
  loadChatMessages,
  saveChatMessage,
  type ChatConversation,
} from '../ai/chat/store.ts'
export {
  estimateTokens,
  fitToContextWindow,
  type ContextWindowOptions,
} from '../ai/chat/context-window.ts'
export type { ModelMessage as ChatModelMessage } from '@reflect/modules/ai'
export { base64ToBytes } from '../lib/base64.ts'
export { isTranscriptionRejected, TranscriptionRejectedError } from '../ai/transcribe-http.ts'
export { transcribeAudio, type TranscriptionRequest } from '../ai/transcribe.ts'
export {
  audioMemoFromPath,
  audioMemoIdentity,
  audioMemoPartFromPath,
  audioMemoPartPath,
  captureAudioMemoPart,
  listAudioMemoSegments,
  listPendingAudioMemoSessions,
  reconcileAudioMemos,
  type AudioMemoSource,
  type CaptureAudioMemoOutcome,
  type CaptureAudioMemoPartInput,
  type ReconcileAudioMemosInput,
  type ReconcileAudioMemosOutcome,
} from '../actions/audio-memo.ts'
export { isSilentStop, type ReconcileStop } from '../app/reconcile.ts'
export {
  AUDIO_MEMO_REMINDER_MS,
  AUDIO_MEMO_SEGMENT_MS,
  type AudioMemoIdentity,
  type AudioMemoSession,
} from '../actions/audio-memo-session.ts'
export {
  captureAckSchema,
  captureEnvelopeSchema,
  captureWireMessageSchema,
  inboxEnvelopeSchema,
  textCaptureEnvelopeSchema,
  textCaptureKindSchema,
  textCaptureSourceSchema,
  TEXT_CAPTURE_MAX_LENGTH,
  type CaptureAck,
  type CaptureEnvelope,
  type CaptureSource,
  type CaptureWireMessage,
  type InboxEnvelope,
  type TextCaptureEnvelope,
  type TextCaptureKind,
  type TextCaptureSource,
} from '../actions/capture-envelope.ts'
export {
  captureFromPath,
  captureIdentity,
  captureNoteMeta,
  appendXPost,
  type XPostEnvelope,
  isCaptureSpoolPath,
  type CaptureIdentity,
  type CaptureNoteMeta,
  type CaptureStatus,
} from '../actions/capture.ts'
export {
  createBacklinkTargetService,
  defaultBacklinkTarget,
  setDefaultBacklinkTarget,
  type BacklinkTargetService,
} from '../capture/backlink-target-service.ts'
export {
  createCaptureDrainService,
  type CaptureDrainService,
  type DrainCaptureInboxInput,
  type DrainCaptureInboxOutcome,
} from '../capture/capture-drain-service.ts'
export {
  createCaptureEnrichmentService,
  type CaptureEnrichmentService,
  type ReconcileCaptureEnrichmentInput,
  type ReconcileCaptureEnrichmentOutcome,
} from '../capture/capture-enrichment-service.ts'
export {
  createCaptureService,
  defaultCapture,
  setDefaultCapture,
  type CaptureService,
  type CaptureSession,
  type CaptureSessionOptions,
} from '../capture/capture-service.ts'
export { createPageMetaService, type PageMetaService } from '../capture/page-meta-service.ts'
export { parsePageMeta, type PageMeta } from '../link-preview/metadata.ts'
export {
  calendarAuthorizationStatus,
  canReadCalendars,
  requestCalendarAccess,
  listCalendars,
  listCalendarEvents,
  subscribeCalendarChanged,
  calendarAuthorizationStatusSchema,
  calendarInfoSchema,
  calendarAttendeeSchema,
  calendarEventSchema,
  type CalendarAuthorizationStatus,
  type CalendarInfo,
  type CalendarAttendee,
  type CalendarEvent,
} from '../calendar/commands.ts'
export { displayEvents, isDeclinedByUser, defaultAttendees, dayRange } from '../calendar/events.ts'
export {
  addMeetingToDaily,
  meetingLine,
  MEETINGS_HEADING,
  type AddMeetingInput,
  type AddMeetingOutcome,
  type MeetingLineAttendee,
} from '../actions/add-meeting.ts'
export {
  resolveMeetingAttendees,
  resolveMeetingAttendeeTargets,
  type MeetingAttendee,
  type ResolvedMeetingAttendee,
} from '../actions/resolve-attendees.ts'
export {
  isDescriptionRejected,
  DescriptionRejectedError,
  type DescribePageRequest,
} from '../ai/page-describer-service.ts'
export {
  isAssetDescriptionRejected,
  AssetDescriptionRejectedError,
  type AssetKind,
  type DescribeAssetRequest,
} from '../ai/describe-asset.ts'
export {
  buildDescriptionSource,
  classifyAsset,
  isEligibleAssetPath,
  reconcileAssetDescriptions,
  readManagedDescription,
  type AssetDescriptionMeta,
  type AssetDescriptionMode,
  type AssetVerdict,
  type ReconcileAssetDescriptionsInput,
  type ReconcileAssetDescriptionsOutcome,
} from '../actions/asset-description.ts'
