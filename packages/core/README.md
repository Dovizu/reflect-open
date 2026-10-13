# @reflect/core

All of Reflect's TypeScript business logic. Platform-agnostic by design:
nothing in this package imports `@tauri-apps/*` — the native shell is reached
through an injected transport, so the same code runs in the desktop app, in
plain vitest, and (later) in the CLI.

## Services and the composition root

Everything stateful in this package is a **service**: an interface `XxxService`
and a factory `createXxxService(deps)` in `<domain>/<name>-service.ts`. The
factory returns an instance of an unexported class that holds the state in `#`
fields. A service
receives the other services it calls through `deps`, and nothing else: the
package has no process-wide instances and no module-level mutable state.

- **`createCoreServices(adapters)`** (`app/create-core-services.ts`) is the
  composition root. It builds every service once, in dependency order, and
  returns them as one **`CoreServices`** object. The host calls it once per
  webview.
- **`CoreAdapters`** is what the host supplies: the IPC transport, the platform
  facts, and the HTTP, storage, dialog, clipboard, opener, path, window and
  lifecycle primitives. The desktop app's adapters are in
  `apps/desktop/src/services/`, and it reads services in React with
  `useCoreServices()`.
- **Per-session factories.** Work that belongs to one graph session is created
  per session, not per app: `createBackupService(deps, options)` and
  `createICloudSyncService(deps, options)` (through `graphServiceFactories`),
  `chatSessions.create()`, `noteSessions.create()`, `capture.openSession()`,
  `assetDescription.openSession()`, `audioMemo.openSession()`. The caller
  disposes what it created when the graph closes.
- **Events.** A service reports changes through `onXxx(listener)` /
  `subscribe(listener)`, which return an unsubscribe function synchronously.
  This package never touches a UI cache; the app maps events to invalidation.
- **`@reflect/core/testing`** (`testing/`) holds the test doubles
  (`createTestXxxService()`) of the services that cannot run in a test or that
  tests script or observe, and `createTestCoreServices()`, the whole
  `CoreServices` object built by the production composition root over them.
  Tests construct the service under test over these doubles.

The conventions are in
[architecture-conventions](../../docs/plans/architecture-conventions.md) §3. To
add a service, follow [services.md](../../docs/contributing/services.md).

## The transport

Every native call goes through one seam:

- **`IpcBridge`** is the transport (`invoke` + `listen`) the host gives to
  `createCoreServices`. The desktop app adapts Tauri; browser dev passes a
  deferred transport that the in-memory dev backend connects later; tests use
  `createTestIpcBridgeService()`.
- **`IpcBridgeService`** (`createIpcBridgeService({ transport, logger })`)
  wraps a transport and is the single point where an untyped IPC response
  becomes a typed value: every response is zod-validated, every rejection is
  coerced to the shared `AppError` contract. Application code never calls the
  transport directly: it calls a method of the service that owns the domain.

## Domains

| Module | What it owns |
|---|---|
| `app/` | The composition root (`create-core-services.ts`), the `GraphSession` type, and the app-wide primitives: `LoggerService`, `ClockService`, `IdService`, `HashService`, `PlatformService`, `StorageService`, `HttpService`, `ProgressPort`, `AppLifecycleService`, `WindowService`, `PersistenceFlushService`. |
| `graph/` | Graph file storage (Plan 02): path helpers (`dailyPath`, `notePath`), zod schemas, the typed file services (`NoteFileService`, `AssetStoreService`), note creation and link resolution (`NoteCreationService`, `NoteLinkResolverService`), and the open graph (`GraphSessionService`, `MobileOnboardingService`). |
| `documents/` | Open notes: the `NoteSession` state machine (`NoteSessionService`), the registry of live sessions (`OpenDocumentsService`), session-aware reads and writes (`NoteDocumentService`), moves and title renames (`NoteMoveService`, `TitleRenameService`), note actions (`NoteActionsService`), attachments and templates. |
| `markdown/` | The document model (Plan 03): frontmatter parsing, the canonical Lezer grammar with the `[[wiki link]]` extension, extraction (`parseNote`), source-level edits, and pure wiki-link resolution policy. |
| `indexing/` | The SQLite projection (Plan 04): `IndexLifecycleService` (open, sync, rebuild, the live watcher subscription), `IndexStoreService` (writes), `FileChangeService`, and the eight read services over `DatabaseService` (`IndexQueryService`, `WikiResolverService`, `BacklinkService`, `SearchService`, `SuggestionService`, `NoteListService`, `GraphStatsService`, `NotePathService`). |
| `daily/` | The date questions about notes: `DailyNoteService` (today, which days have a daily note, the wake onto a new day) and the pure day-window, week-window and month-grid arithmetic of the daily surfaces. |
| `tasks/` | Round-checkbox tasks across notes (Plan 18): `TaskService` (open and completed reads, session-aware writes through `NoteDocumentService.commitSourceEdit`, the session's recently-completed set) and the pure Tasks-view model (grouping, visibility, cache transforms). |
| `search/` | The data layer of the `[[` and `#` menus (`AutocompleteSuggestionService`) and of the command palette (`PaletteSearchService`), plus their pure row assembly. |
| `navigation/` | `NavigationService` (the webview's history), `DeepLinkIntakeService` (`reflect://` intake and resolution), `LinkNavigationService` (what an activated link does), and the pure `Route` and deep-link modules. |
| `commands/` | `CommandService` (the command registry), `KeymapService`, `NativeMenuService`, and the pure keybinding and accelerator rules. |
| `ai/` | BYOK providers (`AiProviderConfigService`, `AiCredentialService`, `LanguageModelService`), the one-shot tasks (selection transform, page and asset describers, transcription), and `ai/chat/` (`ChatEngineService`, `NoteToolsService`, `ChatSessionService`, `ChatHistoryService`). |
| `privacy/` | The `private: true` gate: `PrivacyService` and the `CloudSafe<T>` brand that every provider-bound input requires. |
| `capture/`, `assets/`, `audio/` | The background pipelines of an open graph: link capture, asset descriptions, audio memos (see below). |
| `sync/` | Git backup (`BackupService`, the sync engine, `GitRepositoryService`, the GitHub services) and iCloud (`ICloudSyncService`, `ICloudDownloadService`, `ConflictResolutionService`). |
| `calendar/` | The read-only Apple Calendar integration: `CalendarService` (live EventKit reads), `CalendarEventsService` (the day's events, the settings switch and calendar choice), and the pure display policy of the events panel. |
| `contacts/` | The Apple Contacts integration: `ContactsService` (live lookups), `PersonNoteService` (email identities to `#person` notes), `MeetingService` (a calendar event into its daily note), `ContactSuggestionService` (the suggested-contact card), and the pure matching and Markdown rules. |
| `settings/` | The settings schema, `SettingsService` (the one settings document). |
| `ipc/` | The `IpcBridge` transport type and `IpcBridgeService` described above, plus the typed plugin bindings. |
| `testing/` | The `@reflect/core/testing` entry: test doubles and `createTestCoreServices()`. Never imported by production code. |
| `errors.ts` | The `AppError` discriminated union shared with Rust. |

## Indexing: which entry point?

- **`IndexLifecycleService`** (`CoreServices.indexLifecycle`) runs the open graph's
  index and owns every pass:
  - **`indexNote(path, { generation })`** — one note changed; parse and apply it.
  - **`sync(session)`** — the graph-open path: re-index files whose
    content hash changed and drop rows for deleted files (cheap on an
    already-populated index), or rebuild when the stored projection version is
    stale. Then it subscribes to live changes and starts the Rust file watcher,
    in that order. The live subscription is the *sole* incremental path (our
    own saves flow file → watcher → index like any external edit).
  - **`rebuildVisibly()`** — wipe and re-index the open graph. For
    explicit repair, not the hot path.
  - It reports through events (`onApplied`,
    `onReconciled`, `onMoved`, ...); the app maps them to cache invalidation,
    and the embedding services follow them to re-embed.

**`generation`** is the index session token returned by
`IndexLifecycleService.open()`. Every
write carries it; Rust silently drops writes whose generation is stale, so a
pass started for one graph can never corrupt a newly-opened index. If you add
a write path, thread the generation through — never cache one across a graph
switch. (File writes carry a second, independent token: the graph's file
generation from `graph_open`. Rust-boundary wrappers take whichever they need
as a parameter; user-facing services read both from the open `GraphSession`;
see "The open graph" below.)

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

## Audio memos

Segmented recordings, saved raw under `audio-memos/` and transcribed in the
background with a BYOK model, in `audio/`:

- **`AudioRecorderService`** is the microphone: the webview `MediaRecorder` on
  desktop, the native recorder plugin in the mobile app.
- **`AudioMemoService`** (`CoreServices.audioMemo`) owns the pipeline of one
  graph session. `openPipeline()` is the serial capture queue plus, in the main
  window, the transcription lifecycle; `openSession()` is the desktop recording
  surface over it. A session exposes `getState()` / `subscribe()` and the
  controls the UI calls.
- **`MobileAudioMemoService`** (`CoreServices.mobileAudioMemo`, mobile only) is
  the same surface over the native recorder: staged segments, the orphan scan,
  and, through **`NativeActionService`**, the OS entry points.

The App Review demo key writes one canned note per session. That rule lives in
`TranscriptionService.sessionTranscript`, not in the pipeline.

## The open graph

**`GraphSessionService`** (`CoreServices.graphSession`) owns the active graph of
a webview: its status, the graph and index generations, the recents list, and
the open, create, switch, forget and delete flows. `boot()` runs the window's
boot path: the desktop main window reopens the most recent graph, a note
window adopts the main window's sessions. Read it with `getState()` /
`subscribe()`. `getState().session` is the open graph as one `GraphSession`
object; its `signal` aborts when the graph closes or another open is requested.

`getState().services` is the graph-scoped container of that session
(`GraphServices`, built by `createGraphServices` in
`app/create-graph-services.ts`): the chat session, the backup, and the other
per-graph lifecycles, disposed when `signal` aborts. The session also reloads
open documents after a sync pass, follows healed moves, requests iCloud
downloads for stale placeholders, and drops note-row overlays when a graph is
released. Ordinary services stay app-scoped. Rust-boundary wrappers
(`NoteFileService`) take `generation` as a parameter; user-facing services
(`NoteActionsService`) read the session once at method entry through
`graphSession.getState()` or `requireGraphSession`.

**`MobileOnboardingService`** (`CoreServices.mobileOnboarding`) is the mobile
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
