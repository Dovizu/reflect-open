# @reflect/core

All of Reflect's TypeScript business logic. Platform-agnostic by design:
nothing in this package imports `@tauri-apps/*` — the native shell is reached
through an injected bridge, so the same code runs in the desktop app, in plain
vitest, and (later) in the CLI.

## The bridge

Every native call funnels through two seams:

- **`setBridge(bridge)`** installs the transport (`invoke` + `listen`) once at
  startup. The desktop app adapts Tauri; tests pass an in-memory fake. With no
  bridge installed, command bindings throw a descriptive error and
  `hasBridge()` returns `false` (used to gate native-only features in browser
  dev).
- **`IpcBridgeService`** (`createIpcBridgeService(transport, { logger })`)
  wraps a transport and is the single point where an untyped IPC response
  becomes a typed value: every response is zod-validated, every rejection is
  coerced to the shared `AppError` contract. `setBridge` builds one over the
  installed transport, reachable as `defaultIpc()`; the free `call(command,
  args, schema)` delegates to it. Application code never calls the bridge
  directly: it uses the typed per-domain bindings below.

## Domains

| Module | What it owns |
|---|---|
| `graph/` | Graph file storage (Plan 02): path helpers (`dailyPath`, `notePath`), zod schemas, and the typed file commands (`readNote`, `writeNote`, `listFiles`, recents). |
| `markdown/` | The document model (Plan 03): frontmatter parsing, the canonical Lezer grammar with the `[[wiki link]]` extension, extraction (`parseNote`), source-level edits, and pure wiki-link resolution policy. |
| `indexing/` | The SQLite projection pipeline (Plan 04): build/apply note projections, full rebuild and hash-based reconcile, the live watcher subscription, and the Kysely read getters. |
| `daily/` | The date questions about notes: `DailyNoteService` (today, which days have a daily note, the wake onto a new day) and the pure day-window, week-window and month-grid arithmetic of the daily surfaces. |
| `tasks/` | Round-checkbox tasks across notes (Plan 18): `TaskService` (open and completed reads, session-aware writes through `NoteDocumentService.commitSourceEdit`, the session's recently-completed set) and the pure Tasks-view model (grouping, visibility, cache transforms). |
| `ipc/` | The bridge, `IpcBridgeService`, and `call` seam described above. |
| `errors.ts` | The `AppError` discriminated union shared with Rust. |

## Indexing: which entry point?

- **`indexNote(path, { generation })`** — one note changed; parse and apply it.
- **`IndexLifecycleService`** (`defaultIndexLifecycle()`) runs the open graph's
  index and owns every whole-graph pass:
  - **`sync(generation, isStale)`** — the graph-open path: re-index files whose
    content hash changed and drop rows for deleted files (cheap on an
    already-populated index), or rebuild when the stored projection version is
    stale. Then it subscribes to live changes and starts the Rust file watcher,
    in that order. The live subscription is the *sole* incremental path (our
    own saves flow file → watcher → index like any external edit).
  - **`rebuildVisibly(generation)`** — wipe and re-index everything. For
    explicit repair, not the hot path.
  - It reports through events (`onApplied`, `onChangesApplied`,
    `onReconciled`, `onMoved`, ...); the app maps them to cache invalidation,
    and the embedding services follow them to re-embed.

**`generation`** is the index session token returned by
`IndexLifecycleService.open()`. Every
write carries it; Rust silently drops writes whose generation is stale, so a
pass started for one graph can never corrupt a newly-opened index. If you add
a write path, thread the generation through — never cache one across a graph
switch.

## Embeddings

Optional local semantic search (Plan 09), three services in `embeddings/`:

- **`EmbeddingIndexService`** keeps each note's chunk vectors current:
  `embedNote`, `removeNote`, a full `backfill`, and `follow`, which backfills
  once and then re-embeds the notes of every applied index batch on one
  serial queue.
- **`RetrievalService`** is the one retrieval contract for search and AI:
  `retrieve` (lexical, semantic, or hybrid) and `relatedNotes`.
- **`SemanticSearchService`** is the user-facing side: `start()` loads the
  model while the `semanticSearchEnabled` setting is on, follows the open
  graph while the model is ready, and the service re-embeds after each
  requested index rebuild.

## The open graph

**`GraphSessionService`** (`AppServices.graphSession`) owns the active graph of
a webview: its status, the graph and index generations, the recents list, and
the open, create, switch, forget and delete flows. `boot()` runs the window's
boot path: the desktop main window reopens the most recent graph, a note
window adopts the main window's sessions. Read it with `getState()` /
`subscribe()`. `getState().session` is the open graph as one `GraphSession`
object; its `signal` aborts when the graph closes or another open is requested.

**`MobileOnboardingService`** (`AppServices.mobileOnboarding`) is the mobile
boot path over that session: `boot()` parks a fresh install on onboarding or
opens the graph of the persisted storage kind, and `completeOnboarding()`
opens and persists a storage choice. Storage roots are resolved fresh every
launch, never persisted.

## Conventions

- zod-validate everything that crosses an external boundary (IPC responses,
  file contents, watcher events). Don't re-validate rows from our own SQLite
  projection — they're trusted (see Plan 04 §2).
- TypeScript surfaces are camelCase; Rust serializes camelCase via serde, so
  no mapping happens outside the boundary layers.
- Tests live next to the module they cover and double as its usage docs.
