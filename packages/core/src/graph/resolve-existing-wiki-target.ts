import {
  defaultNoteLinkResolver,
  type ExistingWikiTargetResolution,
} from './note-link-resolver-service.ts'

export type { ExistingWikiTargetResolution } from './note-link-resolver-service.ts'

/** `defaultNoteLinkResolver().resolveWikiTarget`. */
export async function resolveExistingWikiTarget(
  target: string,
  generation: number,
  sourcePath = '',
): Promise<ExistingWikiTargetResolution> {
  return await defaultNoteLinkResolver().resolveWikiTarget(target, generation, sourcePath)
}

/** `defaultNoteLinkResolver().resolveMarkdownHref`. */
export async function resolveExistingMarkdownTarget(
  href: string,
  sourcePath: string,
  generation: number,
): Promise<ExistingWikiTargetResolution> {
  return await defaultNoteLinkResolver().resolveMarkdownHref(sourcePath, href, generation)
}
