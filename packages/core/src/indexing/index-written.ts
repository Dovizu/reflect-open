import { defaultWindow } from '../app/window-service.ts'
import type { Unlisten } from '../ipc/ipc-service.ts'

/**
 * The Rust-side "index rows committed" broadcast (`index:written`), emitted
 * after every note-projection write command. The cross-window sibling of the
 * in-process `index-applied` signal: a secondary note window runs no indexer
 * of its own, so this is how it learns the main window's applies have landed
 * and its index-backed queries are stale. The main window, which did the
 * writing and already invalidates in-process, must not subscribe, or every
 * apply would refetch twice.
 */

/** Event name the Rust index write commands emit after committing. */
export { INDEX_WRITTEN_EVENT } from '../app/window-service.ts'

/**
 * Subscribe to committed index writes. The payload is empty by design: the
 * consumer's move is always "refetch what you show", coalesced on its side.
 */
export function subscribeIndexWritten(handler: () => void): Unlisten {
  return defaultWindow().subscribeIndexWritten(handler)
}
