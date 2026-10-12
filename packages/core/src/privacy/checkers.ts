import type { RetrievalHit } from '../embeddings/retrieve.ts'
import {
  defaultPrivacy,
  type CloudNoteListing,
  type CloudSafe,
  type CloudSearchHit,
  type CloudSendable,
} from './privacy-service.ts'

export {
  assertCloudAllowed,
  cloudSafeAssetDescription,
  cloudSafeGraphContext,
  cloudSafeLinkHref,
  cloudSafeNoteContent,
  cloudSafeSelection,
  isPrivateNoteError,
  notePrivate,
  PrivateNoteError,
  type CloudAssetDescription,
  type CloudGraphContext,
  type CloudNoteContent,
  type CloudNoteListing,
  type CloudSafe,
  type CloudSearchHit,
  type CloudSendable,
} from './privacy-service.ts'

/** `defaultPrivacy().cloudSafeSearchHits`. */
export async function cloudSafeSearchHits(
  hits: readonly RetrievalHit[],
): Promise<CloudSafe<CloudSearchHit>[]> {
  return await defaultPrivacy().cloudSafeSearchHits(hits)
}

/** `defaultPrivacy().cloudSafeNoteListings`. */
export async function cloudSafeNoteListings(
  entries: readonly (CloudSendable & Omit<CloudNoteListing, 'path'>)[],
): Promise<CloudSafe<CloudNoteListing>[]> {
  return await defaultPrivacy().cloudSafeNoteListings(entries)
}
