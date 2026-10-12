import { defaultBacklinks, type BacklinkService } from './backlink-service.ts'

export type {
  Backlink,
  BacklinkContext,
  BacklinkContextPage,
  BacklinkContextPageOptions,
  BacklinkSourceCursor,
} from './backlink-service.ts'

export const getBacklinks: BacklinkService['getBacklinks'] = (...args) =>
  defaultBacklinks().getBacklinks(...args)

export const getBacklinksWithContext: BacklinkService['getBacklinksWithContext'] = (...args) =>
  defaultBacklinks().getBacklinksWithContext(...args)
