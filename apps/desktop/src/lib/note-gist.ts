import { defaultGistPublish } from '@reflect/core'

/*
 * Publishing a note as a secret GitHub gist lives in `@reflect/core`
 * (`GistPublishService`). Each function here delegates to the process-wide
 * service.
 */

/**
 * `defaultGistPublish().publish`: the gist url whenever the publish itself
 * landed, or `null` when it failed (already surfaced).
 */
export async function runGistPublish(path: string, generation: number): Promise<string | null> {
  const result = await defaultGistPublish().publish(path, generation)
  return result?.url ?? null
}

/** `defaultGistPublish().unpublish`: whether the unpublish landed. */
export async function runGistUnpublish(path: string, generation: number): Promise<boolean> {
  const result = await defaultGistPublish().unpublish(path, generation)
  return result !== null
}
