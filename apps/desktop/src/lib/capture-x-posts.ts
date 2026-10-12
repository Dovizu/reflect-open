import type { CaptureService, Unlisten } from '@reflect/core'
import { invalidateXPostQueries } from '@/lib/query-client.ts'

/**
 * Re-read archived X posts whenever a capture pass of `capture` may have
 * written archive JSON. Queries cache forever (`staleTime: Infinity`), so the
 * write must signal here, exactly like the index-change invalidation.
 */
export function watchCaptureXPosts(capture: CaptureService): Unlisten {
  return capture.onXPostsWritten(invalidateXPostQueries)
}
