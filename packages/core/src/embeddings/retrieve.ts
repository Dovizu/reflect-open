import { defaultRetrieval, type RetrievalService } from './retrieval-service.ts'

export {
  bestChunkPerNote,
  fuseRanked,
  mergeNearestFirst,
  type ChunkHitRow,
  type RetrievalHit,
  type RetrieveOptions,
} from './retrieval-service.ts'

export const retrieve: RetrievalService['retrieve'] = (...args) =>
  defaultRetrieval().retrieve(...args)
