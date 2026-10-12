import { defaultSuggestions, type SuggestionService } from './suggestion-service.ts'
import { defaultWikiResolver, type WikiResolverService } from './wiki-resolver-service.ts'

export type { TagSuggestion, WikiLinkSuggestionResult } from './suggestion-service.ts'

export const suggestTags: SuggestionService['suggestTags'] = (...args) =>
  defaultSuggestions().suggestTags(...args)

export const suggestWikiTargets: SuggestionService['suggestWikiTargets'] = (...args) =>
  defaultSuggestions().suggestWikiTargets(...args)

export const suggestWikiLinkTargets: SuggestionService['suggestWikiLinkTargets'] = (...args) =>
  defaultSuggestions().suggestWikiLinkTargets(...args)

export const getWikiAddressForPath: WikiResolverService['getWikiAddressForPath'] = (...args) =>
  defaultWikiResolver().getWikiAddressForPath(...args)
