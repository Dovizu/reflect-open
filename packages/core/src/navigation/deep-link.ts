import { TEXT_CAPTURE_MAX_LENGTH } from '../capture/capture-envelope.ts'

/**
 * The `reflect://` deep-link vocabulary (docs/deep-links.md). URLs are a codec
 * over the existing `Route` union plus two capture verbs — never a
 * second navigation grammar. `deep-link-parse.ts` and `deep-link-format.ts` are the only modules
 * that read or write this syntax.
 */

/** The URL scheme the app registers (`plugins.deep-link` in tauri.conf.json). */
export const DEEP_LINK_SCHEME = 'reflect'

/**
 * Cap on capture-link text (`append`/`task`) — the envelope schema's own cap,
 * enforced here too so an over-long URL is rejected before an envelope is
 * built; the Rust spool command adds a byte cap behind both.
 */
export const DEEP_LINK_TEXT_MAX_LENGTH = TEXT_CAPTURE_MAX_LENGTH
