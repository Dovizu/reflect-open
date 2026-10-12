import {
  defaultTranscriptEnrichment,
  type GenerateAudioMemoTitleRequest,
} from './transcript-enrichment-service.ts'

export {
  audioMemoEnrichmentConfig,
  normalizedAudioMemoTitle,
  pickAudioMemoEnrichmentConfig,
  transcriptFallbackTitle,
  type AudioMemoEnrichmentCredentials,
  type GenerateAudioMemoTitleRequest,
} from './transcript-enrichment-service.ts'

/** A content-derived memo title; see `TranscriptEnrichmentService.generateTitle`. */
export async function generateAudioMemoTitle(
  request: GenerateAudioMemoTitleRequest,
): Promise<string> {
  return await defaultTranscriptEnrichment().generateTitle(request)
}
