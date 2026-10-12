import { defaultTranscription, type TranscriptionRequest } from './transcription-service.ts'

export {
  AUDIO_EXTENSION_BY_MIME,
  baseMimeType,
  GEMINI_INLINE_MAX_BYTES,
  GOOGLE_TRANSCRIPTION_FALLBACK_MODEL,
  GOOGLE_TRANSCRIPTION_MODEL,
  OPENAI_TRANSCRIPTION_FALLBACK_MODEL,
  OPENAI_TRANSCRIPTION_MODEL,
  type TranscriptionRequest,
} from './transcription-service.ts'

/** The transcript of one recording; see `TranscriptionService.transcribe`. */
export async function transcribeAudio(request: TranscriptionRequest): Promise<string> {
  return await defaultTranscription().transcribe(request)
}
