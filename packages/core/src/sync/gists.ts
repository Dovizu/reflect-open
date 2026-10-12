import { defaultGists, type GistFile, type PublishedGist } from './gist-service.ts'
import type { FetchFn } from './github-api.ts'

export type { GistFile, PublishedGist } from './gist-service.ts'

/**
 * Create a secret gist; see `GistService.create`. `_fetchFn` is ignored:
 * requests go through the service's `HttpService`.
 */
export async function createGist(
  token: string,
  file: GistFile,
  _fetchFn?: FetchFn,
): Promise<PublishedGist> {
  return await defaultGists().create(token, file)
}

/**
 * Update a gist in place; see `GistService.update`. `_fetchFn` is ignored:
 * requests go through the service's `HttpService`.
 */
export async function updateGist(
  token: string,
  gistId: string,
  previousFilename: string,
  file: GistFile,
  _fetchFn?: FetchFn,
): Promise<PublishedGist | null> {
  return await defaultGists().update(token, gistId, previousFilename, file)
}

/**
 * Delete a gist; see `GistService.delete`. `_fetchFn` is ignored: requests go
 * through the service's `HttpService`.
 */
export async function deleteGist(token: string, gistId: string, _fetchFn?: FetchFn): Promise<void> {
  await defaultGists().delete(token, gistId)
}
