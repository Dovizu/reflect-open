import type { TextCaptureKind } from '@reflect/core/capture-envelope'
import type { Route } from './route.ts'

/**
 * A parsed deep link:
 *
 * - `navigate` — self-contained routes (`today`, `daily/<date>`, `search`,
 *   `tasks`) that map straight onto {@link Route}.
 * - `openNote` — `note/<target>`, where `<target>` still needs resolution
 *   (frontmatter id → date → title → alias) against the open graph's index.
 * - `capture` — `append`/`checkbox`/`task` write links, spooled into `.reflect/inbox/`.
 *   The capture kind is core's {@link TextCaptureKind} — the URL verb, the
 *   envelope kind, and the drain behavior share the one vocabulary.
 */
export type DeepLink =
  | { kind: 'navigate'; route: Route }
  | { kind: 'openNote'; target: string }
  | { kind: 'capture'; capture: TextCaptureKind; text: string }
