import {
  defaultTranscriptEnrichment,
  type FormatAudioMemoTranscriptRequest,
  type FormattedAudioMemoTranscript,
} from './transcript-enrichment-service.ts'

export type {
  FormatAudioMemoTranscriptRequest,
  FormattedAudioMemoTranscript,
} from './transcript-enrichment-service.ts'

/** The formatted transcript and its title; see `TranscriptEnrichmentService.formatTranscript`. */
export async function formatAudioMemoTranscript(
  request: FormatAudioMemoTranscriptRequest,
): Promise<FormattedAudioMemoTranscript> {
  return await defaultTranscriptEnrichment().formatTranscript(request)
}
