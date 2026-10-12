/** The system clipboard. */
export interface ClipboardService {
  writeText(text: string): Promise<void>
}

let defaultService: ClipboardService | null = null

/** The process-wide `ClipboardService`; throws when the host installed none. */
export function defaultClipboard(): ClipboardService {
  if (defaultService === null) {
    throw new Error('No ClipboardService is installed. Call setDefaultClipboard() at startup.')
  }
  return defaultService
}

/** Install the process-wide `ClipboardService`, or remove it with `null`. */
export function setDefaultClipboard(service: ClipboardService | null): void {
  defaultService = service
}
