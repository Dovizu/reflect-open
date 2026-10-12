import { normalizeWikiTarget, resolved, unresolved, type Resolution } from '../markdown/index.ts'
import { defaultDatabase, type DatabaseService } from './database-service.ts'
import { verifyWikiSuggestionAddresses } from './queries-shared.ts'
import { rankWikiSuggestions, type WikiLinkSuggestion } from './suggest.ts'

/** The winning tier's claimants for a folded key, preserving ambiguity. */
export interface WikiTargetMatch {
  /** One of `CLAIM_TIER`, or {@link UNCLAIMED_TIER} with no paths. */
  readonly tier: number
  readonly paths: readonly string[]
}

/** `WikiTargetMatch.tier` when nothing claims the key (never stored). */
export const UNCLAIMED_TIER = 0

/**
 * Wiki-target resolution over the index's `note_claims` / `note_keys`
 * projection: the one shared resolver, so navigation and backlinks cannot
 * drift onto different claimants.
 */
export interface WikiResolverService {
  /**
   * Resolve a `[[target]]` against the index, returning the note ref (its
   * path). `note_keys` is the canonical resolved-address map: it contains
   * exactly one winning path per folded textual key after applying
   * daily-date, title, alias, and path precedence.
   */
  resolveWikiTarget(target: string): Promise<Resolution>
  /**
   * Look up one folded spelling. `note_claims` already encodes the
   * precedence (templates claim nothing), so this is a single indexed read
   * rather than one query per tier. Unlike {@link resolveWikiTarget}, this
   * does not collapse a tier to its first path; callers that may create on a
   * miss need to distinguish one existing note from several notes claiming
   * the same spelling.
   */
  findWikiTargetMatch(key: string): Promise<WikiTargetMatch>
  /** Every indexed note whose folded path matches, sorted. */
  findNotesByPathKey(pathKey: string): Promise<string[]>
  /** Distinct source paths of links whose folded target key is `targetKey`. */
  getLinkSources(targetKey: string): Promise<string[]>
  /** Distinct source paths of links that name a file by folded vault path. */
  getPathLinkSources(targetPathKey: string): Promise<string[]>
  /**
   * Return a verified wiki-link suggestion for one indexed note path. This is
   * the path-first counterpart to text search: it uses the same canonical
   * title, `note_keys` winner checks, rich-title address, and alias rescue.
   */
  getWikiAddressForPath(path: string): Promise<WikiLinkSuggestion | null>
}

export function createWikiResolverService(deps: {
  database: DatabaseService
}): WikiResolverService {
  const { db } = deps.database
  return {
    async resolveWikiTarget(target) {
      const normalized = normalizeWikiTarget(target)
      if (normalized.key === '') {
        return unresolved(normalized.raw)
      }
      const winner = await db
        .selectFrom('noteKeys')
        .where('key', '=', normalized.key)
        .select('notePath')
        .executeTakeFirst()
      return winner?.notePath ? resolved(winner.notePath) : unresolved(normalized.raw)
    },

    async findWikiTargetMatch(key) {
      if (key === '') {
        return { tier: UNCLAIMED_TIER, paths: [] }
      }
      const rows = await db
        .selectFrom('noteClaims')
        .where('key', '=', key)
        .select(['notePath', 'tier'])
        .orderBy('tier')
        .orderBy('notePath')
        .execute()
      const tier = rows[0]?.tier
      return tier === undefined
        ? { tier: UNCLAIMED_TIER, paths: [] }
        : {
            tier,
            paths: [...new Set(rows.filter((row) => row.tier === tier).map((row) => row.notePath))],
          }
    },

    async findNotesByPathKey(pathKey) {
      if (pathKey === '') {
        return []
      }
      const rows = await db
        .selectFrom('notes')
        .where('pathKey', '=', pathKey)
        .select('path')
        .distinct()
        .orderBy('path')
        .execute()
      return rows.map((row) => row.path)
    },

    async getLinkSources(targetKey) {
      const rows = await db
        .selectFrom('links')
        .where('targetKey', '=', targetKey)
        .select('sourcePath')
        .distinct()
        .orderBy('sourcePath')
        .execute()
      return rows.map((row) => row.sourcePath)
    },

    async getPathLinkSources(targetPathKey) {
      const rows = await db
        .selectFrom('links')
        .where('targetPathKey', '=', targetPathKey)
        .select('sourcePath')
        .distinct()
        .orderBy('sourcePath')
        .execute()
      return rows.map((row) => row.sourcePath)
    },

    async getWikiAddressForPath(path) {
      const note = await db
        .selectFrom('notes')
        .where('path', '=', path)
        .where('kind', '!=', 'template')
        .select(['path', 'title', 'titleKey', 'dailyDate', 'mtime'])
        .executeTakeFirst()
      if (note === undefined) {
        return null
      }
      const candidate = rankWikiSuggestions('', [{ ...note, linkCount: 0 }], [], 1)[0]
      if (candidate === undefined) {
        return null
      }
      const result = await verifyWikiSuggestionAddresses(
        db,
        [candidate],
        [note.titleKey],
        1,
        '',
        false,
      )
      return result.suggestions[0] ?? null
    },
  }
}

let installedService: WikiResolverService | null = null
let fallback: { service: WikiResolverService; database: DatabaseService } | null = null

/**
 * The process-wide `WikiResolverService`; one over {@link defaultDatabase}
 * unless {@link setDefaultWikiResolver} installed another.
 */
export function defaultWikiResolver(): WikiResolverService {
  if (installedService !== null) {
    return installedService
  }
  const database = defaultDatabase()
  if (fallback?.database !== database) {
    fallback = { service: createWikiResolverService({ database }), database }
  }
  return fallback.service
}

/** Install the process-wide `WikiResolverService`; `null` restores the one over the default database. */
export function setDefaultWikiResolver(service: WikiResolverService | null): void {
  installedService = service
}
