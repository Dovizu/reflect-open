import { defaultOpener } from '@reflect/core'

/** Open `url` with its default handler; callers that surface failures in the UI use this. */
export function openUrl(url: string): Promise<void> {
  return defaultOpener().openUrl(url)
}

/**
 * Fire-and-forget {@link openUrl} for sync UI handlers that have no use for
 * the promise. A rejection (no handler for the scheme, or the opener
 * capability denies it) is logged instead of becoming an unhandled rejection.
 */
export function openUrlSync(url: string): void {
  defaultOpener().openUrlSync(url)
}
