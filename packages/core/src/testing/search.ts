import type { ClockService } from '../app/clock-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { OperationsService } from '../app/operations-service.ts'
import type { CommandService } from '../commands/command-service.ts'
import type { RetrievalService } from '../embeddings/retrieval-service.ts'
import type { NoteCreationService } from '../graph/note-creation-service.ts'
import type { DatabaseService } from '../indexing/database-service.ts'
import { createSearchService, type SearchService } from '../indexing/search-service.ts'
import { createSuggestionService, type SuggestionService } from '../indexing/suggestion-service.ts'
import { createWikiResolverService } from '../indexing/wiki-resolver-service.ts'
import {
  createPaletteSearchService,
  type PaletteSearchService,
} from '../search/palette-search-service.ts'
import {
  createWikiLinkSuggestionService,
  type WikiLinkPersonNotes,
  type WikiLinkSuggestionService,
} from '../search/wiki-link-suggestion-service.ts'
import type { SettingsService } from '../settings/settings-service.ts'
import { createTestClockService } from './clock.ts'
import { createTestCommandService } from './commands.ts'
import { createTestDatabaseService } from './database.ts'
import { createTestRetrievalService } from './embeddings.ts'
import { createTestNoteCreationService } from './graph.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestOperationsService } from './operations.ts'
import { createTestSettingsService } from './settings.ts'

/**
 * Person-note operations without an address book: no Contact matches, every
 * Contact resolves as a new person, and `ensurePersonNote` goes straight to
 * `noteCreation`.
 */
export function createTestWikiLinkPersonNotes(
  noteCreation: Pick<NoteCreationService, 'resolveOrCreateNoteWithTitle'>,
): WikiLinkPersonNotes {
  return {
    contactLinkSuggestions: async () => [],
    resolvePersonContact: async (contact) => ({
      kind: 'new',
      contact,
      insertText: contact.fullName,
    }),
    ensurePersonNote: async (input) =>
      await noteCreation.resolveOrCreateNoteWithTitle(input.title, input.generation, input.body),
  }
}

export interface TestWikiLinkSuggestionServiceOptions {
  /** Defaults to the real {@link SuggestionService} over `database`. */
  suggestions?: Pick<SuggestionService, 'suggestWikiLinkTargets' | 'suggestTags'>
  /** Defaults to a fresh {@link createTestNoteCreationService}. */
  noteCreation?: Pick<NoteCreationService, 'resolveOrCreateNoteWithTitle'>
  /** Defaults to {@link createTestWikiLinkPersonNotes} over `noteCreation`. */
  personNotes?: WikiLinkPersonNotes
  /** Defaults to a fresh {@link createTestSettingsService}. */
  settings?: Pick<SettingsService, 'get'>
  /** Defaults to a fresh {@link createTestClockService}. */
  clock?: Pick<ClockService, 'now'>
  /** Defaults to a fresh {@link createTestOperationsService}. */
  operations?: Pick<OperationsService, 'start'>
  /** Defaults to a fresh {@link createTestLoggerService}. */
  logger?: LoggerService
  /** The index behind the default `suggestions`. Defaults to an empty one. */
  database?: DatabaseService
}

/** The real {@link WikiLinkSuggestionService} over test doubles (fresh ones by default). */
export function createTestWikiLinkSuggestionService(
  options?: TestWikiLinkSuggestionServiceOptions,
): WikiLinkSuggestionService {
  const noteCreation = options?.noteCreation ?? createTestNoteCreationService()
  return createWikiLinkSuggestionService({
    suggestions:
      options?.suggestions ??
      createSuggestionService({ database: options?.database ?? createTestDatabaseService() }),
    noteCreation,
    personNotes: options?.personNotes ?? createTestWikiLinkPersonNotes(noteCreation),
    settings: options?.settings ?? createTestSettingsService(),
    clock: options?.clock ?? createTestClockService(),
    operations: options?.operations ?? createTestOperationsService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}

export interface TestPaletteSearchServiceOptions<Context = unknown> {
  /** Defaults to the real {@link SuggestionService} over `database`. */
  suggestions?: Pick<SuggestionService, 'suggestWikiTargets'>
  /** Defaults to the real {@link SearchService} over `database`. */
  search?: Pick<SearchService, 'searchWithFilters'>
  /** Defaults to a {@link createTestRetrievalService} without hits. */
  retrieval?: Pick<RetrievalService, 'retrieve'>
  /** Defaults to an empty {@link createTestCommandService}. */
  commands?: Pick<CommandService<Context>, 'list'>
  /** Defaults to a fresh {@link createTestClockService}. */
  clock?: Pick<ClockService, 'now'>
  /** The index behind the default `suggestions` and `search`. Defaults to an empty one. */
  database?: DatabaseService
}

/** The real {@link PaletteSearchService} over test doubles (fresh ones by default). */
export function createTestPaletteSearchService<Context = unknown>(
  options?: TestPaletteSearchServiceOptions<Context>,
): PaletteSearchService<Context> {
  const database = options?.database ?? createTestDatabaseService()
  return createPaletteSearchService({
    suggestions: options?.suggestions ?? createSuggestionService({ database }),
    search:
      options?.search ??
      createSearchService({ database, wikiResolver: createWikiResolverService({ database }) }),
    retrieval: options?.retrieval ?? createTestRetrievalService(),
    commands: options?.commands ?? createTestCommandService<Context>(),
    clock: options?.clock ?? createTestClockService(),
  })
}
