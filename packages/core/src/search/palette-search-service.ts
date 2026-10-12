import { defaultClock, type ClockService } from '../app/clock-service.ts'
import { defaultCommands, type Command, type CommandService } from '../commands/command-service.ts'
import { defaultRetrieval, type RetrievalService } from '../embeddings/retrieval-service.ts'
import { dateFromDailyPath } from '../graph/paths.ts'
import type { DateSuggestionContext } from '../indexing/date-suggestion-types.ts'
import { parseSearchQuery } from '../indexing/filter-query.ts'
import { defaultSearch, type SearchService } from '../indexing/search-service.ts'
import type { WikiSuggestion } from '../indexing/suggest.ts'
import { defaultSuggestions, type SuggestionService } from '../indexing/suggestion-service.ts'
import { localIsoDate } from '../lib/dates.ts'
import { updatedPresetFilter, type UpdatedFilter, type UpdatedPreset } from './all-notes-filters.ts'
import { buildPaletteSections, type PaletteHit, type PaletteSections } from './palette-entries.ts'

/** What {@link PaletteSearchService.sections} merges. */
export interface PaletteSectionsInput {
  /** The live query, as typed. */
  query: string
  /** The query the data arrays actually answer (the deferred value). */
  dataQuery: string
  suggestions: WikiSuggestion[]
  /** The one search path's results (filters may be empty — Plan 08b). */
  hits: PaletteHit[]
  /** True when the data query carried filter tokens (describes `hits`). */
  filtered: boolean
}

/**
 * The command palette's data layer (Plan 08): the two index reads (title
 * suggestions + the one search path, whose filters may be empty) and the
 * merge into the sectioned result model. Query deferral, caching and the
 * settled/failed accounting stay with the caller. The pure rules live in
 * `palette-entries.ts`; the mobile All tab's query model in
 * `all-notes-filters.ts`.
 */
export interface PaletteSearchService<Context = unknown> {
  /**
   * Today's local calendar date as `YYYY-MM-DD`, read from the wall clock.
   * The generated date suggestions are relative to it, so callers that cache
   * {@link suggestTitles} make it part of the cache identity.
   */
  today(): string
  /** Title suggestions for `text` (at most 8), generated date phrases merged in. */
  suggestTitles(text: string, dateContext: DateSuggestionContext): Promise<WikiSuggestion[]>
  /**
   * The search hits for `text`. Filter tokens (#tag, is:daily, is:pinned,
   * links:, linked-from:, updated:) switch the search into constrained mode
   * (Plan 08b); plain text is the same query with empty filters. With
   * `hybrid`, plain text blends semantic hits via RRF; filtered queries stay
   * constraint-based — filters are exact by nature.
   */
  search(text: string, options: { hybrid: boolean }): Promise<PaletteHit[]>
  /** Merge the data with every registered command into the palette's sections. */
  sections(input: PaletteSectionsInput): PaletteSections<Command<Context>>
  /** Resolve a relative updated-at preset of the mobile All tab against the clock. */
  updatedPresetFilter(preset: UpdatedPreset): UpdatedFilter
}

export interface PaletteSearchServiceDeps<Context = unknown> {
  suggestions: Pick<SuggestionService, 'suggestWikiTargets'>
  search: Pick<SearchService, 'searchWithFilters'>
  retrieval: Pick<RetrievalService, 'retrieve'>
  commands: Pick<CommandService<Context>, 'list'>
  clock: Pick<ClockService, 'now'>
}

export function createPaletteSearchService<Context = unknown>(
  deps: PaletteSearchServiceDeps<Context>,
): PaletteSearchService<Context> {
  const { suggestions, search, retrieval, commands, clock } = deps
  return {
    today: () => localIsoDate(new Date(clock.now())),

    suggestTitles: (text, dateContext) => suggestions.suggestWikiTargets(text, 8, dateContext),

    async search(text, options) {
      const parsed = parseSearchQuery(text)
      if (!options.hybrid || parsed.filtered) {
        return await search.searchWithFilters(parsed)
      }
      // Adapt RetrievalHit → PaletteHit: semantic chunk text rides in
      // the snippet slot, and the path stands in for the dailyDate the
      // retrieval contract doesn't carry.
      const hits = await retrieval.retrieve(text, { mode: 'hybrid' })
      return hits.map((hit) => ({
        path: hit.path,
        title: hit.title,
        dailyDate: dateFromDailyPath(hit.path),
        snippet: hit.snippet === '' ? null : hit.snippet,
      }))
    },

    sections: (input) => buildPaletteSections({ ...input, commands: commands.list() }),

    updatedPresetFilter: (preset) => updatedPresetFilter(preset, new Date(clock.now())),
  }
}

let installedService: PaletteSearchService | null = null
let fallback: (PaletteSearchServiceDeps & { service: PaletteSearchService }) | null = null

/**
 * The process-wide `PaletteSearchService`; one over the default services
 * unless {@link setDefaultPaletteSearch} installed another.
 */
export function defaultPaletteSearch(): PaletteSearchService {
  if (installedService !== null) {
    return installedService
  }
  const deps: PaletteSearchServiceDeps = {
    suggestions: defaultSuggestions(),
    search: defaultSearch(),
    retrieval: defaultRetrieval(),
    commands: defaultCommands(),
    clock: defaultClock(),
  }
  if (
    fallback?.suggestions !== deps.suggestions ||
    fallback.search !== deps.search ||
    fallback.retrieval !== deps.retrieval ||
    fallback.commands !== deps.commands ||
    fallback.clock !== deps.clock
  ) {
    fallback = { ...deps, service: createPaletteSearchService(deps) }
  }
  return fallback.service
}

/**
 * Install the process-wide `PaletteSearchService`; `null` restores the one
 * over the default services.
 */
export function setDefaultPaletteSearch(service: PaletteSearchService | null): void {
  installedService = service
}
