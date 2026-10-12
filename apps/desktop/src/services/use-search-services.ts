import {
  defaultPaletteSearch,
  defaultWikiLinkSuggestions,
  type PaletteSearchService,
  type WikiLinkSuggestionService,
} from '@reflect/core'
import type { CommandContext } from '@/lib/commands/types.ts'
import { useOptionalAppServices } from '@/services/services-provider.tsx'

/**
 * The `WikiLinkSuggestionService` of the nearest `AppServicesProvider`, else
 * the process-wide default.
 */
export function useWikiLinkSuggestionService(): WikiLinkSuggestionService {
  return useOptionalAppServices()?.wikiLinkSuggestions ?? defaultWikiLinkSuggestions()
}

/**
 * The `PaletteSearchService` of the nearest `AppServicesProvider`, else the
 * process-wide default, typed with the context this app's commands run with.
 */
export function usePaletteSearchService(): PaletteSearchService<CommandContext> {
  return useOptionalAppServices()?.paletteSearch ?? defaultPaletteSearch()
}
