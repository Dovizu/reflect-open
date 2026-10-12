import type { ClockService } from '../app/clock-service.ts'
import type { LoggerService } from '../app/logger-service.ts'
import type { PlatformService } from '../app/platform-service.ts'
import type { WebFetchService } from '../app/web-fetch-service.ts'
import { createEmbedMediaService, type EmbedMediaService } from '../embeds/embed-media-service.ts'
import type { XArchiveService } from '../x-archive.ts'
import { createTestWebFetchService, createTestXArchiveService } from './capture.ts'
import { createTestClockService } from './clock.ts'
import { createTestLoggerService } from './logger.ts'
import { createTestPlatformService } from './platform.ts'

export interface TestEmbedMediaServiceOptions {
  /** Defaults to an empty {@link createTestXArchiveService}. */
  xArchive?: Pick<XArchiveService, 'resolve' | 'write' | 'fetchSyndication'>
  /** Defaults to a {@link createTestWebFetchService} with no answers. */
  webFetch?: Pick<WebFetchService, 'fetchOembed'>
  platform?: Pick<PlatformService, 'convertFileSrc'>
  clock?: Pick<ClockService, 'now' | 'setTimeout' | 'clearTimeout'>
  logger?: Pick<LoggerService, 'error'>
}

/** The real {@link EmbedMediaService} over test doubles (fresh ones by default). */
export function createTestEmbedMediaService(
  options?: TestEmbedMediaServiceOptions,
): EmbedMediaService {
  return createEmbedMediaService({
    xArchive: options?.xArchive ?? createTestXArchiveService(),
    webFetch: options?.webFetch ?? createTestWebFetchService(),
    platform: options?.platform ?? createTestPlatformService(),
    clock: options?.clock ?? createTestClockService(),
    logger: options?.logger ?? createTestLoggerService(),
  })
}
