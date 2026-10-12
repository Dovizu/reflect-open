import { formatAudioMemoTranscript } from './audio-memo-format.ts'
import { generateAudioMemoTitle } from './audio-memo-title.ts'
import {
  routeSessionTranscriptEnrichment,
  type EnrichedSessionTranscript,
  type EnrichSessionTranscriptInput,
} from './transcript-enrichment-service.ts'

export {
  FORMAT_MAX_CHARS,
  TITLE_INPUT_MAX_CHARS,
  type EnrichedSessionTranscript,
  type EnrichSessionTranscriptInput,
} from './transcript-enrichment-service.ts'

/**
 * The enriched transcript of one session; see `TranscriptEnrichmentService.enrich`.
 * The two calls go through `generateAudioMemoTitle` and
 * `formatAudioMemoTranscript`, the seams that the audio memo tests replace.
 */
export async function enrichSessionTranscript(
  input: EnrichSessionTranscriptInput,
): Promise<EnrichedSessionTranscript> {
  return await routeSessionTranscriptEnrichment(
    { generateTitle: generateAudioMemoTitle, formatTranscript: formatAudioMemoTranscript },
    input,
  )
}
